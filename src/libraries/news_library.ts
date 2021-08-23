import {RowDataPacket} from "mysql";
import {datetimeString} from "./time_library";

const { pool } = require('../helpers/database');

export async function findCategoryIdx(category: String): Promise<number> {
    let categorySql = "SELECT * FROM news_categories WHERE category=?";
    try {
        const [queryResults] = await pool.promise().query(categorySql, [category]);
        if (!queryResults[0]) {
            console.error('no category found');
            return -1;
        }
        return queryResults[0].idx;
    } catch (err) {
        console.error(err.message);
        return -1;
    }
}

// 분야가 이미 db에 저장되어 있지 않다면 추가
export async function updateCategories(category:string) {
    let categorySql = "SELECT * FROM `news_categories` WHERE `category` = ?";

    try {
        const [queryResults] = await pool.promise().query(categorySql, [category]);
        if(!queryResults[0]) {
            let insertCategorySql:string = "INSERT INTO `news_categoryes`(`category`) VALUES (?)";
            try {
                const [insertResult] = await pool.promise().query(insertCategorySql, [category]);
                return insertResult.insertId;
            } catch(err) {
                console.error(err.message);
                throw err;
            }
        } else {
            return queryResults[0].idx;
        }
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

// 카테고리들 불러오기
export async function getCategories(onlyVisible:boolean = true, categories:string[] = []) {
    let categoriesSql:string = "SELECT * FROM `news_categories` WHERE 1=1";
    if(onlyVisible) {
        categoriesSql += " AND `status`=1";
    }
    if(categories.length > 0) {
        categoriesSql += " AND category IN (";
        for(const category of categories) {
            categoriesSql += "'" + category + "'";
            if(categories.indexOf(category) < categories.length - 1) {
                categoriesSql += ", ";
            }
        }
        categoriesSql += ")";
    }
    try {
        const [queryResults] = await pool.promise().query(categoriesSql);
        let idxs:number[] = [];
        let categories:string[] = [];
        let topics:string[] = [];
        queryResults.forEach((result:RowDataPacket) => {
            if(result.category && result.category != '') {
                idxs.push(result.idx);
                categories.push(result.category);
                topics.push(result.fcm_topic);
            }
        })
        return {
            'idxs': idxs,
            'categories': categories,
            'topics': topics
        };
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

export async function getNewsByIdx(newsIdx:number) {
    let newsSql = "SELECT *, TIMESTAMPDIFF(MINUTE, news.created_time, CURRENT_TIMESTAMP) as diff_minutes FROM `news` WHERE idx=? ORDER BY news.idx DESC LIMIT 1";
    try {
        const [queryResults] = await pool.promise().query(newsSql, [newsIdx]);
        return queryResults[0];
    } catch(err) {
        console.error(err);
        throw err;
    }
}

export async function getNewsInCategory(categoryIdx:number, limit:number) {
    let newsInCategoriesSql = "SELECT *, TIMESTAMPDIFF(MINUTE, news.created_time, CURRENT_TIMESTAMP) as diff_minutes FROM `news` JOIN `news_categories_map` ON news_categories_map.news_idx = news.idx WHERE news_categories_map.category_idx=? ORDER BY news.idx DESC LIMIT ?";
    try {
        const [queryResults] = await pool.promise().query(newsInCategoriesSql, [categoryIdx, limit]);
        for(let i:number = 0; i < queryResults.length; i++) {
            let diffMinutes: number = queryResults[i].diff_minutes;
            let diffHours: number = 0;
            let diffDays: number = 0;
            if (diffMinutes >= 60) {
                diffHours = Math.floor(diffMinutes / 60);
                diffMinutes %= 60;
                queryResults[i].diffHours = diffHours;
                queryResults[i].diffMinutes = diffMinutes;
            } else {
                queryResults[i].diffMinutes = diffMinutes;
            }
            if (diffHours >= 24) {
                diffDays = Math.floor(diffHours / 24);
                diffHours %= 24;
                queryResults[i].diffDays = diffDays;
                queryResults[i].diffHours = diffHours;
            }
        }
        return queryResults;
    } catch(err) {
        console.error(err);
        throw err;
    }
}

export async function getNewsInCategoryWithInteractions(categoryIdx:number, limit:number, userIdx:number) {
    let newsInCategoriesSql = "SELECT *, TIMESTAMPDIFF(MINUTE, news.created_time, CURRENT_TIMESTAMP) as diff_minutes," +
        " (SELECT COUNT(*) FROM user_view_logs WHERE user_view_logs.user_idx=? AND user_view_logs.article_type='news' AND user_view_logs.article_idx=news.idx) as my_views" +
        " FROM `news`" +
        " JOIN `news_categories_map` ON news_categories_map.news_idx = news.idx" +
        " WHERE news_categories_map.category_idx=?" +
        " ORDER BY news.idx DESC LIMIT ?";
    try {
        const [queryResults] = await pool.promise().query(newsInCategoriesSql, [userIdx, categoryIdx, limit]);
        for(let i:number = 0; i < queryResults.length; i++) {
            let diffMinutes: number = queryResults[i].diff_minutes;
            let diffHours: number = 0;
            let diffDays: number = 0;
            if (diffMinutes >= 60) {
                diffHours = Math.floor(diffMinutes / 60);
                diffMinutes %= 60;
                queryResults[i].diffHours = diffHours;
                queryResults[i].diffMinutes = diffMinutes;
            } else {
                queryResults[i].diffMinutes = diffMinutes;
            }
            if (diffHours >= 24) {
                diffDays = Math.floor(diffHours / 24);
                diffHours %= 24;
                queryResults[i].diffDays = diffDays;
                queryResults[i].diffHours = diffHours;
            }
        }
        return queryResults;
    } catch(err) {
        console.error(err);
        throw err;
    }
}

// 뉴스와 분야 map db에 저장
export async function saveNewsCategoriesMap(categoryIdx:number, newsIdx:number) {
    let mapSql:string = "INSERT INTO `news_categories_map`(`category_idx`, `news_idx`) VALUES (?, ?)";
    try {
        const [insertResult] = await pool.promise().query(mapSql, [categoryIdx, newsIdx]);
    } catch(err) {
        console.error(err);
        throw err;
    }
}

/**
 * 실시간 조회수 TOP 뉴스 불러오기
 * @param limit
 */
export async function getPopularNews(limit:number = 5) {
    let searchPopularNewsSql = "SELECT `article_idx`, COUNT(*) as `count` FROM `user_view_logs` WHERE `article_type`='news' GROUP BY `article_idx` ORDER BY `count` DESC LIMIT ?";
    try {
        const [queryResults] = await pool.promise().query(searchPopularNewsSql, [limit]);
        let newsData:RowDataPacket[] = [];
        for(let i:number = 0; i < queryResults.length; i++) {
            newsData.push(await getNewsByIdx(queryResults[i].article_idx));
        }
        for(let i:number = 0; i < newsData.length; i++) {
            let diffMinutes: number = newsData[i].diff_minutes;
            let diffHours: number = 0;
            let diffDays: number = 0;
            if (diffMinutes >= 60) {
                diffHours = Math.floor(diffMinutes / 60);
                diffMinutes %= 60;
                newsData[i].diffHours = diffHours;
                newsData[i].diffMinutes = diffMinutes;
            } else {
                newsData[i].diffMinutes = diffMinutes;
            }
            if (diffHours >= 24) {
                diffDays = Math.floor(diffHours / 24);
                diffHours %= 24;
                newsData[i].diffDays = diffDays;
                newsData[i].diffHours = diffHours;
            }
        }
        return newsData;
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

/**
 * 실시간 조회수 TOP 뉴스 불러오기
 * @param limit
 */
export async function getPopularNewsWithInteractions(userIdx:number, limit:number = 5) {
    let searchPopularNewsSql = "SELECT `user_view_logs`.`article_idx`," +
        " (SELECT COUNT(DISTINCT user_idx) FROM user_view_logs as uv WHERE uv.article_type='news' AND uv.article_idx=user_view_logs.article_idx) as `count`," +
        " (SELECT COUNT(*) FROM user_view_logs as uv_logs WHERE uv_logs.user_idx=? AND uv_logs.article_type='news' AND uv_logs.article_idx=user_view_logs.article_idx) as my_views," +
        " `news`.`idx` as news_idx, `news`.`title`, `news`.`from`, `news`.`url`, `news`.`created_time`," +
        " TIMESTAMPDIFF(MINUTE, news.created_time, CURRENT_TIMESTAMP) as diff_minutes" +
        " FROM `user_view_logs`" +
        " JOIN `news` ON news.idx=user_view_logs.article_idx" +
        " WHERE `article_type`='news' AND user_view_logs.viewed_time > ?" +
        " GROUP BY `user_view_logs`.`article_idx` ORDER BY `count` DESC, `article_idx` DESC LIMIT ?";
    try {
        const [queryResults] = await pool.promise().query(searchPopularNewsSql, [userIdx, datetimeString("ISO", {changeDateBy: -1}), limit]);
        for(let i:number = 0; i < queryResults.length; i++) {
            let diffMinutes: number = queryResults[i].diff_minutes;
            let diffHours: number = 0;
            let diffDays: number = 0;
            if (diffMinutes >= 60) {
                diffHours = Math.floor(diffMinutes / 60);
                diffMinutes %= 60;
                queryResults[i].diffHours = diffHours;
                queryResults[i].diffMinutes = diffMinutes;
            } else {
                queryResults[i].diffMinutes = diffMinutes;
            }
            if (diffHours >= 24) {
                diffDays = Math.floor(diffHours / 24);
                diffHours %= 24;
                queryResults[i].diffDays = diffDays;
                queryResults[i].diffHours = diffHours;
            }
        }
        return queryResults;
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}
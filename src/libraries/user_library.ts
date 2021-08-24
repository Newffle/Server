import {RowDataPacket} from "mysql";
import {datetimeString} from "./time_library";
import {subscribeTokensToTopic, subscribeToOSAndroidTopic, unsubscribeTokensFromTopic} from "./push_library";

const { pool } = require('../helpers/database');

/**
 * 유저가 새 FCM 토큰 발급받은 경우, 관심 분야 푸시 구독
 * @param fcmToken
 */
export async function subscribeUserFcmTokensToTopics(userIdx:number, fcmTokens: string[]) {
    if(fcmTokens.length < 1) {
        return;
    }
    const pushOn = await getUserPushOnOff(userIdx);
    if(!pushOn) {
        return;
    }
    const categorySubscriptions = await getUserCategorySubscriptionData(userIdx);
    for(const optionIndex in categorySubscriptions.categoryNotifications) {
        if(categorySubscriptions.categoryNotifications[optionIndex] != 0) {
            await subscribeTokensToTopic(categorySubscriptions.topics[optionIndex], fcmTokens);
        }
    }
}

export async function unsubscribeUserFcmTokensFromTopics(userIdx:number, fcmTokens: string[]) {
    if(fcmTokens.length < 1) {
        return;
    }
    const categorySubscriptions = await getUserCategorySubscriptionData(userIdx);
    for(const optionIndex in categorySubscriptions.categoryNotifications) {
        if(categorySubscriptions.categoryNotifications[optionIndex] != 0) {
            await unsubscribeTokensFromTopic(categorySubscriptions.topics[optionIndex], fcmTokens);
        }
    }
}

/**
 * 유저의 정기 구독 정보를 확인하는 함수
 */
export async function getUserCurrentPlan(userIdx:number) {
    let searchUserCurrentPlanSql = "SELECT * FROM `user_current_plan` WHERE `status`=1 AND `user_idx`=? LIMIT 1";
    try {
        const [queryResult] = await pool.promise().query(searchUserCurrentPlanSql, [userIdx]);
        if(!queryResult[0]) {
            return -1;
        } else {
            return queryResult[0].plan;
        }
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

/**
 * 유저 푸시 전체를 받을지 말지 설정을 조회
 * @param userIdx number
 * @return number
 */
export async function getUserPushOnOff(userIdx:number):Promise<number> {
    let searchUserPushOnSql = "SELECT * FROM `users` WHERE `idx`=?";
    try {
        const [queryResult] = await pool.promise().query(searchUserPushOnSql, [userIdx]);
        if(!queryResult[0]) {
            console.error('no user found');
            return -1;
        } else {
            return queryResult[0].push_on;
        }
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

export async function saveUserMarketingConsent(userIdx:number, consent:boolean) {
    const consentInt = consent ? 1 : 0;
    let searchMarketingConsentSql = "SELECT * FROM `marketing_consent` WHERE `user_idx`=?";
    try {
        const [queryResult] = await pool.promise().query(searchMarketingConsentSql, [userIdx]);
        if(!queryResult[0]) {
            let insertMarketingConsentSql = "INSERT INTO `marketing_consent`(`user_idx`, `consent`) VALUES (?, ?)";
            try {
                const [insertResult] = await pool.promise().query(insertMarketingConsentSql, [userIdx, consentInt]);
            } catch(err) {
                console.error(err.message);
                throw err;
            }
        } else {
            if(queryResult[0].consent != consentInt) {
                let updateMarketingConsentSql = "UPDATE `marketing_consent` SET `consent`=? WHERE `user_idx`=?";
                try {
                    const [updateResult] = await pool.promise().query(updateMarketingConsentSql, [consentInt, userIdx]);
                } catch(err) {
                    console.error(err.message);
                    throw err;
                }
            }
        }
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

/**
 * 유저가 푸시 전체를 받을지 말지 설정을 저장
 * @param userIdx
 */
export async function setUserPushOnOff(userIdx:number, pushOn:number) {
    let updateUserPushOnSql = "UPDATE `users` SET `push_on`=? WHERE `idx`=?";
    try {
        const updateResult = await pool.promise().query(updateUserPushOnSql, [pushOn, userIdx]);
        if(updateResult[0].affectedRows > 0) {
            return true;
        }
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

/**
 * 유저의 카테고리별  전체를 받을지 말지 설정을 조회
 * @param userIdx number
 * @return number
 */
export async function getUserCategorySubscriptionData(userIdx:number) {
    let searchUserSubscriptionData = "SELECT DISTINCT `category`, `fcm_topic`, `notification_option` FROM `user_category_subscriptions` JOIN `news_categories` ON `news_categories`.`idx`=`user_category_subscriptions`.`category_idx` WHERE `user_idx`=? AND `news_categories`.`status`=1";
    try {
        const [queryResults] = await pool.promise().query(searchUserSubscriptionData, [userIdx]);
        let categories:string[] = [];
        let topics:string[] = [];
        let categoryNotifications:number[] = [];
        queryResults.forEach((result:RowDataPacket) => {
            if(result.category != null && result.category != '') {
                categories.push(result.category);
            }
            if(result.fcm_topic != null && result.fcm_topic != '') {
                topics.push(result.fcm_topic);
            }
            if(result.notification_option != null) {
                categoryNotifications.push(result.notification_option);
            }
        })
        return {
            'categories': categories,
            'topics': topics,
            'categoryNotifications': categoryNotifications,
        };
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

/**
 * 유저가 각 카테고리별로 푸시 알림을 받을지 말지 설정을 저장
 * @param userIdx
 * @param categoryIdx
 * @param notificationOn
 */
export async function setUserCategoryNotificationOption(userIdx:number, categoryIdx:number, notificationOption:number) {
    let updateCategoryNotificationSql = "UPDATE `user_category_subscriptions` SET `notification_option`=? WHERE `user_idx`=? AND `category_idx`=?";
    try {
        const updateResult = await pool.promise().query(updateCategoryNotificationSql, [notificationOption, userIdx, categoryIdx]);
        if(updateResult[0].affectedRows > 0) {
            return true;
        }
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

/**
 * 유저가 뉴스 읽음 처리
 */
export async function insertReadLog(userIdx:number, articleType:string, articleIdx:number) {
    let insertReadLogSql = "INSERT INTO `user_view_logs`(`user_idx`, `article_type`, `article_idx`) VALUES (?, ?, ?)";
    try {
        const insertResult = await pool.promise().query(insertReadLogSql, [userIdx, articleType, articleIdx]);
        return insertResult[0].insertId;
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

/**
 * 유저가 저장한 항목들을 불러오기
 */
export async function getUserSavedArticles(userIdx:number, limit:number = -1, offset:number = 0) {
    let searchSavedSql = "SELECT user_saved_articles.idx as saved_idx, user_saved_articles.article_type, user_saved_articles.article_idx as article_idx," +
        " CASE user_saved_articles.article_type WHEN 'insight' THEN insights.title WHEN 'summary' THEN media_summaries.title WHEN 'news' THEN news.title ELSE news.title END AS article_title," +
        " CASE user_saved_articles.article_type WHEN 'insight' THEN insights.url WHEN 'summary' THEN media_summaries.url WHEN 'news' THEN news.url ELSE news.url END AS article_url," +
        " IF(user_view_logs.idx IS NOT NULL, 1, 0) as viewed" +
        " FROM user_saved_articles" +
        " LEFT JOIN news ON article_type='news' AND article_idx=news.idx" +
        " LEFT JOIN insights ON article_type='insight' AND article_idx=insights.idx" +
        " LEFT JOIN media_summaries ON article_type='summary' AND article_idx=media_summaries.idx" +
        " LEFT JOIN user_view_logs ON user_saved_articles.article_type = user_view_logs.article_type AND user_saved_articles.article_idx = user_view_logs.article_idx" +
        " WHERE user_saved_articles.user_idx = ? AND user_saved_articles.`status` = 1" +
        " AND (news.`status` = 1 OR insights.`status` = 1 OR media_summaries.`status` = 1)" +
        " GROUP BY saved_idx ORDER BY user_saved_articles.updated_time DESC";
    if(limit > 0) {
        searchSavedSql += " LIMIT " + limit;
    }
    if(offset > 0) {
        searchSavedSql += " OFFSET " + offset;
    }
    try {
        const [queryResults] = await pool.promise().query(searchSavedSql, [userIdx]);
        return queryResults;
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

/**
 * 유저가 특정 항목을 저장했는지 확인
 */
export async function checkUserSavedArticle(userIdx:number, articleType:string, articleIdx:number) {
    let searchSavedSql = "SELECT * FROM user_saved_articles WHERE user_idx = ? AND article_type = ? AND article_idx = ? AND `status` = 1 LIMIT 1";
    try {
        const [queryResult] = await pool.promise().query(searchSavedSql, [userIdx, articleType, articleIdx]);
        if (!queryResult[0]) {
            return false;
        } else {
            return true;
        }
    } catch(err) {
        console.error(err.message);
        return false;
    }
}

/**
 * 유저가 항목을 저장 또는 저장 취소
 */
export async function saveOrUnsaveArticle(userIdx:number, articleType:string, articleIdx:number, save:boolean = true) {
    let sql;
    if (save) {
        let searchSavedSql = "SELECT * FROM user_saved_articles WHERE user_idx = ? AND article_type = ? AND article_idx = ? LIMIT 1";
        try {
            const [queryResult] = await pool.promise().query(searchSavedSql, [userIdx, articleType, articleIdx]);
            if (!queryResult[0]) {
                sql = "INSERT INTO user_saved_articles(user_idx, article_type, article_idx) VALUES(?, ?, ?)";
            } else {
                if (queryResult[0].status == 1) {
                    return true;
                } else {
                    sql = "UPDATE user_saved_articles SET `status` = 1 WHERE user_idx = ? AND article_type = ? AND article_idx = ?";
                }
            }
        } catch(err) {
            console.error(err.message);
            return false;
        }
    } else {
        sql = "UPDATE user_saved_articles SET `status` = 0 WHERE user_idx = ? AND article_type = ? AND article_idx = ?";
    }
    try {
        const [queryResult] = await pool.promise().query(sql, [userIdx, articleType, articleIdx]);
        return true;
    } catch(err) {
        console.error(err.message);
        return false;
    }
}
import {datetimeString} from "./time_library";

const { pool } = require('../helpers/database');

export async function getPartnerInsights(limit:number = -1, offset:number = 0) {
    let searchInsightDataSql = "SELECT `insights`.`idx` as insight_idx, `partner`, `logo_image_url`, `title`, `url` FROM `insights` JOIN `partners` ON `insights`.`partner_idx`=`partners`.`idx` WHERE `partners`.`status`=1 AND `insights`.`status`=1 ORDER BY `insights`.`idx` DESC";
    if(limit > 0) {
        searchInsightDataSql += " LIMIT " + limit;
    }
    if(offset > 0) {
        searchInsightDataSql += " OFFSET " + offset;
    }
    try {
        const [queryResults] = await pool.promise().query(searchInsightDataSql, []);
        return queryResults;
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

export async function getMediaSummaries(limit:number = -1, offset:number = 0) {
    let searchSummariesSql = "SELECT `media_summaries`.`idx` as summary_idx, `name`, `logo_image_url`, `title`, `url`" +
        " FROM `media_summaries`" +
        " JOIN `media_channel` ON `media_summaries`.`media_channel_idx`=`media_channel`.`idx`" +
        " WHERE `media_channel`.`status`=1" +
        " AND `media_summaries`.`status`=1" +
        " ORDER BY `media_summaries`.`idx` DESC";
    if(limit > 0) {
        searchSummariesSql += " LIMIT " + limit;
    }
    if(offset > 0) {
        searchSummariesSql += " OFFSET " + offset;
    }
    try {
        const [queryResults] = await pool.promise().query(searchSummariesSql, []);
        return queryResults;
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

export async function getNativeBanners() {
    let getBannerSql = "SELECT * FROM `native_banners` WHERE `status`=1 AND `show_until` > ? ORDER BY priority ASC";
    try {
        const [queryResults] = await pool.promise().query(getBannerSql, [datetimeString("ISO", {})]);
        return queryResults;
    } catch(err) {
        console.error(err.message);
        throw err;
    }

}
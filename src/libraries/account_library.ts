import {getUserCurrentPlan, subscribeUserFcmTokensToTopics, unsubscribeUserFcmTokensFromTopics} from "./user_library";
import {datetimeString} from "./time_library";
const { pool } = require('../helpers/database');

/**
 * 해당 이메일로 기존에 생성된 계정이 있는지 확인
 */
export async function checkUserExists(email: string) {
    let checkUserExistsSql = "SELECT * FROM `users` WHERE email=? AND `active`=1";
    let userExists = false;
    try {
        const [queryResult] = await pool.promise().query(checkUserExistsSql, [email]);
        userExists = Boolean(queryResult[0]);
    } catch(err) {
        console.error(err.message);
        throw err;
    } finally {
        return userExists;
    }
}

/**
 * 유저가 가입/로그인 시 유저의 기기 정보를 저장하는 로직 모음
 * @param userIdx
 * @param data
 */
export async function updateUserDeviceDataFlow(userIdx: number, data: { os: string; version: string; osVersion: string; fcmToken: string; }) {
    const deviceInfoIdx: number = await updateDeviceInfo(userIdx, data.os, data.version, data.osVersion);
    await updateUserDeviceLog(userIdx, deviceInfoIdx);
    await updateUserCurrentDevice(userIdx, deviceInfoIdx, data.fcmToken);
}

/**
 * 유저의 os, 버전, os버전 정보를 저장
 * @param userIdx
 * @param os
 * @param version
 * @param osVersion
 */
export async function updateDeviceInfo(userIdx: number, os: string, version: string, osVersion: string = '') {
    let searchLastDeviceSql = "SELECT * FROM `device_info` WHERE os=? AND version=? AND os_version=? ORDER BY idx DESC";
    try {
        const [queryResult] = await pool.promise().query(searchLastDeviceSql, [os, version, osVersion]);
        if (!queryResult[0]) {
            // 기존에 저장되어 있던 디바이스 정보가 없는 경우 디바이스 정보 새로 저장
            let insertDeviceInfoSql = "INSERT INTO `device_info`(`os`, `version`, `os_version`) VALUES (?, ?, ?)";
            try {
                let insertResult = await pool.promise().query(insertDeviceInfoSql, [os, version, osVersion]);
                return insertResult[0].insertId;
            } catch(err) {
                console.error(err.message);
                throw err;
            }
        } else {
            // 기존에 저장되어 있던 디바이스 정보가 있는 경우에는 디바이스 정보 따로 추가 처리하지 않음
            return queryResult[0].idx;
        }
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

/**
 * 유저의 접속 기기 로그
 * @param userIdx
 * @param deviceInfoIdx
 */
export async function updateUserDeviceLog(userIdx: number, deviceInfoIdx: number) {
    let searchDeviceLogSql = "SELECT * FROM `user_device_log` WHERE user_idx=? AND device_info_idx=? ORDER BY idx DESC";
    try {
        const [queryResults] = await pool.promise().query(searchDeviceLogSql, [userIdx, deviceInfoIdx]);
        if(!queryResults[0]) {
            // 디바이스 로그가 없는 경우 디바이스 로그 새로 저장
            let insertDeviceLogSql = "INSERT INTO `user_device_log`(`user_idx`, `device_info_idx`) VALUES (?, ?)";
            try {
                const insertResult = await pool.promise().query(insertDeviceLogSql, [userIdx, deviceInfoIdx]);
                return insertResult[0].insertId;
            } catch(err) {
                console.error(err.message);
                throw err;
            }
        } else {
            // 디바이스 로그가 있는 경우 디바이스 로그 업데이트
            let updateDeviceLogSql = "UPDATE `user_device_log` SET `updated_time`=CURRENT_TIMESTAMP() WHERE `idx`=?";
            try {
                const updateResult = await pool.promise().query(updateDeviceLogSql, [queryResults[0].idx]);
                if(updateResult[0].affectedRows > 0) {
                }
                return queryResults[0].idx;
            } catch(err) {
                console.error(err.message);
                throw err;
            }
        }
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

/**
 * 유저가 가장 최근에 로그인한 기기 정보 업데이트
 * @param userIdx
 * @param deviceInfoIdx
 */
export async function updateUserCurrentDevice(userIdx: number, deviceInfoIdx: number, fcmToken: string) {
    const userCurrentPlan = await getUserCurrentPlan(userIdx);
    let maxDevices = 1;
    switch(userCurrentPlan) {
        case 1:
            maxDevices = 3;
            break;
        case 2:
            maxDevices = 100;
            break;
    }
    maxDevices = 3;
    let searchCurrentDeviceSql = "SELECT idx, device_info_idx, fcm_token, `status`" +
        " FROM `user_current_device` WHERE user_idx=? GROUP BY idx ORDER BY updated_time ASC";
    try {
        const [queryResults] = await pool.promise().query(searchCurrentDeviceSql, [userIdx, deviceInfoIdx, fcmToken, userIdx]);
        let activeFcmTokens:string[] = [];
        let deactivatedFcmTokens:string[] = [];
        let idx = -1;
        if (!queryResults[0]) {
            // 유저의 현재 기기 정보가 저장되어 있지 않은 경우 새로 저장
            let insertCurrentDeviceSql = "INSERT INTO `user_current_device`(`user_idx`, `device_info_idx`, `fcm_token`) VALUES (?, ?, ?)";
            try {
                const insertResult = await pool.promise().query(insertCurrentDeviceSql, [userIdx, deviceInfoIdx, fcmToken]);
                idx = insertResult[0].insertId;
                activeFcmTokens.push(fcmToken);
            } catch(err) {
                console.error(err.message);
                throw err;
            }
        } else {
            let previousRow = null;
            for(const row of queryResults) {
                if(row.status != 0) {
                    activeFcmTokens.push(row.fcm_token);
                }
                if(row.device_info_idx == deviceInfoIdx && row.fcm_token == fcmToken) {
                    idx = row.idx;
                    previousRow = row;
                }
            }
            // 유저의 현재 기기 정보가 저장되어 있지 않은 경우 새로 저장
            if(idx == -1) {
                let insertCurrentDeviceSql = "INSERT INTO `user_current_device`(`user_idx`, `device_info_idx`, `fcm_token`) VALUES (?, ?, ?)";
                try {
                    const insertResult = await pool.promise().query(insertCurrentDeviceSql, [userIdx, deviceInfoIdx, fcmToken]);
                    idx = insertResult[0].insertId;
                    activeFcmTokens.push(fcmToken);
                } catch(err) {
                    console.error(err.message);
                    throw err;
                }
            }
            // 유저의 현재 기기 정보가 저장되어 있는데 status가 0인 경우 되살리기
            else if(previousRow != null) {
                if(previousRow.status == 0) {
                    let reactivatePreviousDeviceSql = "UPDATE `user_current_device` SET `status`=1 WHERE `idx`=?";
                    try {
                        const updateResult = await pool.promise().query(reactivatePreviousDeviceSql, [idx]);
                    } catch(err) {
                        console.error(err.message);
                        throw err;
                    }
                }
            }

            if(activeFcmTokens.length > maxDevices) {
                for(let i = 0; i < activeFcmTokens.length - maxDevices; i++) {
                    if(queryResults[i].fcm_token == fcmToken) {
                        continue;
                    }
                    let updatePreviousDeviceStatusSql = "UPDATE `user_current_device` SET `status`=0 WHERE `idx`=?";
                    try {
                        const updateResult = await pool.promise().query(updatePreviousDeviceStatusSql, [queryResults[i].idx]);
                        deactivatedFcmTokens.push(queryResults[i].fcm_token);
                    } catch(err) {
                        console.error(err.message);
                        throw err;
                    }
                }
            }
            await unsubscribeUserFcmTokensFromTopics(userIdx, deactivatedFcmTokens.filter(token => token != fcmToken));
        }
        // 새로 FCM 토큰 정보를 저장했다면, 이 새 FCM 토큰도 유저의 관심분야 구독 진행
        if(activeFcmTokens.length > queryResults.length) {
            await subscribeUserFcmTokensToTopics(userIdx, [fcmToken]);
        }
    } catch(err) {
        console.error(err.message);
        throw(err);
    }
}

/**
 * 유저가 기존에 인증한 내역이 있는지를 확인
 */
export async function checkUserVerification(userIdx:number, type:string = 'email') {
    let searchVerificationSql = "SELECT * FROM `user_verifications` WHERE user_idx=? AND `type`=? LIMIT 1";
    try {
        const [queryResults] = await pool.promise().query(searchVerificationSql, [userIdx, type]);
        console.log(queryResults);
        if(!queryResults[0]) {
            return false;
        } else {
            return true;
        }
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

/**
 * 유저가 이메일, 핸드폰 번호 등을 인증했을 시 인증 기록
 */
export async function saveUserVerification(userIdx:number, type:string = 'email') {
    if(await checkUserVerification(userIdx, type)) {
        return;
    }
    let insertVerificationSql = "INSERT INTO `user_verifications`(`user_idx`, `type`) VALUES (?, ?)";
    try {
        const [insertResult] = await pool.promise().query(insertVerificationSql, [userIdx, type]);
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

/**
 * 유저의 비밀번호를 덮어씌울 수 있는 값으로 초기
 * @param email
 */
export async function resetUserPassword(email:string) {
    let resetPasswordSql = "UPDATE `users` SET `password`='@' WHERE `email`=? and `active`=1";
    try {
        const [updateResult] = await pool.promise().query(resetPasswordSql, [email]);
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

/**
 * 비밀번호가 덮어씌워질 값인 유저의 비밀번호 업데이트
 */
export async function updateUserPassword(userIdx:number, password:string) {
    let updatePasswordSql = "UPDATE `users` SET `password`=? WHERE `idx`=?";
    try {
        const [updateResult] = await pool.promise().query(updatePasswordSql, [password, userIdx]);
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

/**
 * 유저 회원탈퇴 진행
 * @param userIdx
 */
export async function deleteUserAccount(userIdx:number) {
    let setUserInactiveSql = "UPDATE `users` SET `active`=0 WHERE `idx`=?";
    try {
        const [updateResult] = await pool.promise().query(setUserInactiveSql, [userIdx]);
    } catch(err) {
        console.error(err.message);
        throw err;
    }
    let insertOutUserSql = "INSERT INTO `out_users`(`user_idx`) VALUES (?)";
    try {
        const [insertResult] = await pool.promise().query(insertOutUserSql, [userIdx]);
    } catch(err) {
        console.error(err.message);
        throw err;
    }
    let updateDeviceStatusSql = "UPDATE `user_current_device` SET `status`=0 WHERE `user_idx`=?";
    try {
        const updateResult = await pool.promise().query(updateDeviceStatusSql, [userIdx]);
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

export async function updateUserCurrentPlan(userIdx: number) {
    let searchUserCurrentPlanSql = "SELECT * FROM `user_current_plan` WHERE user_idx=? ORDER BY idx DESC";
    try {
        const [queryResults] = await pool.promise().query(searchUserCurrentPlanSql, [userIdx]);
        if(!queryResults[0]) {
            // 유저의 현재 기기 정보가 저장되어 있지 않은 경우 새로 저장
            let insertUserCurrentPlan = "INSERT INTO `user_current_plan`(`user_idx`, `plan`, `status`, `valid_until`) VALUES (?, ?, ?, ?)";
            let datetime1MonthLater = datetimeString("ISO", {changeMonthBy: 1});
            try {
                const insertResult = await pool.promise().query(insertUserCurrentPlan, [userIdx, 1, 1, datetime1MonthLater]);
                return insertResult[0].insertId;
            } catch(err) {
                throw err;
            }
        }
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

export async function findUserIdxFromUid(uid:string) {
    let searchUserIdxSql = "SELECT * FROM users WHERE firebase_uid=?";
    try {
        const [queryResult] = await pool.promise().query(searchUserIdxSql, [uid]);
        if(!queryResult[0]) {
            console.error('no user idx found for firebase_uid:', uid);
            return -1;
        } else {
            return queryResult[0].idx;
        }
    } catch(err) {
        console.error(err);
        return -1;
    }
}

export async function getUserDataFromUid(uid:string) {
    let searchUserSql = "SELECT * FROM users WHERE firebase_uid=?";
    try {
        const [queryResult] = await pool.promise().query(searchUserSql, [uid]);
        if(!queryResult[0]) {
            console.error('no user found');
            return [];
        } else {
            return queryResult[0];
        }
    } catch(err) {
        console.error(err);
        return -1;
    }
}
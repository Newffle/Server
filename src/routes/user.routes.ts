import {Request, Response, Router} from 'express';
import {
    findCategoryIdx,
    getCategories,
    getNewsInCategoryWithInteractions
} from "../libraries/news_library";
import {
    getUserCategorySubscriptionData,
    getUserPushOnOff, setUserCategoryNotificationOption,
    setUserPushOnOff, insertReadLog, getUserSavedArticles, checkUserSavedArticle, saveOrUnsaveArticle
} from "../libraries/user_library";
//import {subscribeToOSAndroidTopic} from "../libraries/push_library";
import {checkUserVerification, findUserIdxFromUid, getUserDataFromUid} from "../libraries/account_library";

const { pool } = require('../helpers/database');

const userRouter = Router();
/*
userRouter.get('/test/:fcmToken', async(req:Request, res:Response) => {
    const fcmToken = req.params.fcmToken;
    await subscribeToOSAndroidTopic(fcmToken);
    res.sendStatus(200);
});*/

/**
 * 유저가 조회 가능한 조회 등 반응 정보 포함된 카테고리의 뉴스 불러오기
 */
userRouter.post('/news_in_category_with_interactions', async (req: Request, res: Response) => {
    let data:any = req.body;
    const categoryIdx:number = await findCategoryIdx(data.category);
    const userIdx = await findUserIdxFromUid(data.uid);

    let limit:number = 20;
    if(data.limit != null) {
        limit = data.limit;
    }

    const news = await getNewsInCategoryWithInteractions(categoryIdx, limit, userIdx);
    res.json(news);
});

/**
 * 유저의 관심분야들을 불러오기
 */
userRouter.get('/categories/:uid', async (req: Request, res: Response) => {
    const uid:string = req.params.uid;
    const userIdx:number = await findUserIdxFromUid(uid);

    const categoryData = await getCategories();
    const categories:string[] = categoryData.categories;
    const topics:string[] = categoryData.topics;

    const userCategorySubscriptions = await getUserCategorySubscriptionData(userIdx)
    res.json({
        categories: categories,
        topics: topics,
        userCategories: userCategorySubscriptions.categories
    });
});

/**
 * 유저가 뉴스, 글 등을 읽었다는 로그를 기록
 */
userRouter.post('/read/:type', async (req: Request, res: Response) => {
    const type:string = req.params.type;
    const data:any = req.body;
    const userIdx = await findUserIdxFromUid(data.uid);
    const articleIdx = data.articleIdx;

    if(articleIdx) {
        await insertReadLog(userIdx, type, articleIdx);
        const alreadySaved:boolean = await checkUserSavedArticle(userIdx, type, articleIdx);
        res.json({
            saved: alreadySaved
        });
    } else {
        res.sendStatus(403);
    }
});

/**
 * 관심분야 구독
 */
userRouter.post('/categories/subscribe', async(req: Request, res: Response) => {
    let data:any = req.body;
    const category:string = data.category;
    const userIdx = await findUserIdxFromUid(data.uid);

    const categoryIdx = await findCategoryIdx(category);
    let insertCategorySql = "INSERT INTO user_category_subscriptions(user_idx, category_idx, status, notification_option) VALUES(?, ?, ?, ?)";
    try {
        const [insertResult] = await pool.promise().query(insertCategorySql, [userIdx, categoryIdx, 1, 1]);
    } catch(err) {
        console.error(err.message);
        res.sendStatus(400);
    }
    res.sendStatus(200);
});
/**
 * 관심분야 구독 취소
 */
userRouter.post('/categories/unsubscribe', async(req: Request, res: Response) => {
        let data:any = req.body;
    const category:string = data.category;
    const userIdx = await findUserIdxFromUid(data.uid);

    const categoryIdx = await findCategoryIdx(category);
    let deleteCategorySql = "DELETE FROM `user_category_subscriptions` WHERE `user_idx`=? AND `category_idx`=?";
    try {
        const [deleteResult] = await pool.promise().query(deleteCategorySql, [userIdx, categoryIdx]);
    } catch(err) {
        console.error(err.message);
        res.sendStatus(400);
    }
    res.sendStatus(200);
});

/**
 * 유저의 푸시 알림 설정들을 조회하기
 */
userRouter.post('/categories/notifications', async (req:Request, res:Response) => {
    const data:any = req.body;
    const uid:string = data.uid;
    const userIdx:number = await findUserIdxFromUid(uid);

    const userPushOn = await getUserPushOnOff(userIdx);
    const userCategoryNotificationOptions = await getUserCategorySubscriptionData(userIdx)
    const userNotificationOptions = {
        'pushOn' : userPushOn,
        'categories': userCategoryNotificationOptions.categories,
        'topics': userCategoryNotificationOptions.topics,
        'categoryNotifications' : userCategoryNotificationOptions.categoryNotifications
    }
    res.json(userNotificationOptions);
});
/**
 * 유저의 푸시 알림 전체 설정 업데이트하기
 */
userRouter.post('/categories/notifications/push_on', async(req:Request, res:Response) => {
    const data:any = req.body;
    const uid:string = data.uid;
    const userIdx:number = await findUserIdxFromUid(uid);
    await setUserPushOnOff(userIdx, data.pushOn);
    res.sendStatus(200);
});
/**
 * 유저의 카테고리별 푸시 알림 설정 업데이트하기
 */
userRouter.post('/categories/notifications/category', async(req:Request, res:Response) => {
    const data:any = req.body;
    const uid:string = data.uid;
    const userIdx:number = await findUserIdxFromUid(uid);
    const category:string = data.category;
    const categoryIdx:number = await findCategoryIdx(category);
    const categoryNotification:number = data.categoryNotification;
    await setUserCategoryNotificationOption(userIdx, categoryIdx, categoryNotification)
    res.sendStatus(200);
});

/**
 * 유저의 계정 설정들 불러오기
 */
userRouter.post('/account_settings', async(req:Request, res:Response) => {
   const data:any = req.body;
   const uid:string = data.uid;
   const user:any = await getUserDataFromUid(uid);
   user.emailVerified = await checkUserVerification(user.idx, 'email');
   res.json(user);
});

/**
 *
 */
userRouter.post('/saved_items', async(req:Request, res:Response) => {
    const data:any = req.body;
    const uid:string = data.uid;
    const userIdx:number = await findUserIdxFromUid(uid);
    let limit:number = data.limit;
    let offset:number = data.offset;
    if(limit == null || limit < 0) {
        limit = 10;
    }
    if(offset == null || offset < 0) {
        offset = 0;
    }
    const articles = await getUserSavedArticles(userIdx, limit, offset);
    res.json({
        'articles': articles,
    });
});
/**
 * 뉴스 저장
 */
userRouter.post('/article/save', async(req: Request, res: Response) => {
    let data:any = req.body;
    const userIdx = await findUserIdxFromUid(data.uid);
    const articleType = data.articleType;
    const articleIdx = data.articleIdx;

    const saveResult:boolean = await saveOrUnsaveArticle(userIdx, articleType, articleIdx, true);
    if (saveResult) {
        res.sendStatus(200);
    } else {
        res.sendStatus(400);
    }
});
/**
 * 뉴스 저장 취소
 */
userRouter.post('/article/unsave', async(req: Request, res: Response) => {
    let data:any = req.body;
    const userIdx = await findUserIdxFromUid(data.uid);
    const articleType = data.articleType;
    const articleIdx = data.articleIdx;

    const saveResult:boolean = await saveOrUnsaveArticle(userIdx, articleType, articleIdx, false);
    if (saveResult) {
        res.sendStatus(200);
    } else {
        res.sendStatus(400);
    }
});

export default userRouter;
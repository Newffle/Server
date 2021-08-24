import {Request, Response, Router} from 'express';
import {getMediaSummaries, getNativeBanners, getPartnerInsights} from "../libraries/board_library";
import {getPopularNewsWithInteractions} from "../libraries/news_library";
import {getUserCurrentPlan, getUserSavedArticles} from "../libraries/user_library";
import {findUserIdxFromUid} from "../libraries/account_library";

const boardRouter = Router();

boardRouter.post('/meta', async (req: Request, res: Response) => {
    const data:any = req.body;
    const uid:string = data.uid;
    const userIdx:number = await findUserIdxFromUid(uid);

    const userPlan = await getUserCurrentPlan(userIdx);
    const popularNews = await getPopularNewsWithInteractions(userIdx);
    const insights = await getPartnerInsights(3);
    const summaries = await getMediaSummaries(3);
    const banners = await getNativeBanners();
    const saved = await getUserSavedArticles(userIdx, 3);

    res.json({
        'userPlan': userPlan,
        'popularNews': popularNews,
        'insights': insights,
        'summaries': summaries,
        'banners': banners,
        'saved': saved,
    });
});

boardRouter.post('/insights', async (req: Request, res: Response) => {
    const data:any = req.body;
    let limit:number = data.limit;
    let offset:number = data.offset;
    if(limit == null || limit < 0) {
        limit = 10;
    }
    if(offset == null || offset < 0) {
        offset = 0;
    }
    const insights = await getPartnerInsights(limit, offset);
    res.json({
        'insights': insights,
    });
});

boardRouter.post('/media_summaries', async (req: Request, res: Response) => {
    const data:any = req.body;
    let limit:number = data.limit;
    let offset:number = data.offset;
    if(limit == null || limit < 0) {
        limit = 10;
    }
    if(offset == null || offset < 0) {
        offset = 0;
    }
    const summaries = await getMediaSummaries(limit, offset);
    res.json({
        'summaries': summaries,
    });
});

export default boardRouter;
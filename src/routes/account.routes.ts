import {Request, Response, Router} from 'express';
import {Md5} from 'ts-md5/dist/md5';
import {
    checkUserExists, deleteUserAccount, findUserIdxFromUid, resetUserPassword,
    saveUserVerification, updateUserCurrentPlan,
    updateUserDeviceDataFlow, updateUserPassword
} from "../libraries/account_library";
import {saveUserMarketingConsent} from "../libraries/user_library";

const { pool } = require('../helpers/database');

const accountRouter = Router();

accountRouter.post('/check_already_signed_up', async (req: Request, res: Response) => {
    let data:any = req.body;
    const userExists = await checkUserExists(data.email);
    if(userExists) {
        res.sendStatus(401);
    } else {
        res.sendStatus(200);
    }
});

accountRouter.post('/signup', async (req: Request, res: Response) => {
    let data:any = req.body;

    const userExists = await checkUserExists(data.email);
    if(userExists) {
        console.error('user already exists');
        res.sendStatus(401);
    } else {
        let createUserSql = "INSERT INTO `users`(`email`, `password`, `signup_from`, `firebase_uid`) VALUES (?, ?, ?, ?)";

        try {
            const [insertResult] = await pool.promise().query(createUserSql, [
                data.email,
                Md5.hashStr(data.password),
                data.os,
                data.firebaseUid]
            );
            const userIdx: number = insertResult.insertId;
            await updateUserDeviceDataFlow(userIdx, data);
            await updateUserCurrentPlan(userIdx);

            if(data.emailVerified == "true") {
                await saveUserVerification(userIdx, 'email');
            }
            await saveUserMarketingConsent(userIdx, data.marketingConsent == "true");

            res.sendStatus(200);
        } catch(err) {
            console.error(err.message);
            res.sendStatus(400);
        }
    }
});

accountRouter.post('/login', async (req: Request, res: Response) => {
    let data:any = req.body;
    let loginUserSql = "SELECT * FROM `users` WHERE email=? AND active=1 ORDER BY idx DESC LIMIT 1";
    try {
        const [result] = await pool.promise().query(loginUserSql, [data.email]);
        if (result[0]) {
            if(result[0].password == '@') {
                await updateUserPassword(result[0].idx, Md5.hashStr(data.password));
            } else if(result[0].password == Md5.hashStr(data.password)){
            } else {
                console.error('no user data found');
                res.sendStatus(400);
            }
            try {
                const userIdx: number = result[0].idx;
                await updateUserDeviceDataFlow(userIdx, data);

                res.sendStatus(200);
            } catch (err) {
                console.error(err.message);
                res.sendStatus(401);
            }
        } else {
            console.error('no user data found');
            res.sendStatus(400);
        }
    } catch (err) {
        console.error(err.message);
        res.sendStatus(400);
    }
});

accountRouter.post('/logout', async (req: Request, res: Response) => {
    let data:any = req.body;
    console.log('data:', data);
    res.sendStatus(200);
});

accountRouter.post('/reset_password', async (req:Request, res:Response) => {
    let data:any = req.body;
    const email:string = data.email;

    await resetUserPassword(email);
    res.sendStatus(200);
});

accountRouter.post('/set_password', async (req:Request, res:Response) => {
    let data:any = req.body;
    const uid:string = data.uid;
    const userIdx:number = await findUserIdxFromUid(uid);
    const password:string = data.password;

    await updateUserPassword(userIdx, Md5.hashStr(password));
    res.sendStatus(200);
});

accountRouter.post('/verify/:type', async (req:Request, res:Response) => {
    let data:any = req.body;
    const uid:string = data.uid;
    const userIdx:number = await findUserIdxFromUid(uid);
    const type:string = req.params.type;

    await saveUserVerification(userIdx, type);
    res.sendStatus(200);
});

accountRouter.post('/delete_account', async (req:Request, res:Response) => {
    let data:any = req.body;
    const uid:string = data.uid;
    const userIdx:number = await findUserIdxFromUid(uid);

    await deleteUserAccount(userIdx);
    res.sendStatus(200);
});

export default accountRouter;
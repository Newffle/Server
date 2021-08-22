import {Request, Response, Router} from 'express';
import {RowDataPacket} from "mysql";
import {checkWorkingTime} from "../libraries/time_library";
const { pool } = require('../helpers/database');

const generalRouter = Router();

generalRouter.get('/meta/:screen', async(req:Request, res:Response) => {
    const screen:string = req.params.screen;
    // 메인화면 메타
    if(screen == 'main') {
        // 현재 영업시간인지 확인
        let worktime:boolean = checkWorkingTime();

        // 메뉴 항목들 불러오기
        let drawerMenuItemsSql = "SELECT * FROM `drawer_menu_items` WHERE `status`=1 ORDER BY `order` ASC";
        let menuNames:string[] = [];
        let menuRoutes:string[] = [];
        try {
            const [queryResults] = await pool.promise().query(drawerMenuItemsSql);
            queryResults.forEach((result:RowDataPacket) => {
                if(result.menu != null && result.category != '') {
                    menuNames.push(result.menu);
                }
                if(result.route != null && result.route != '') {
                    menuRoutes.push(result.route);
                }
            });
            res.json({
                'worktime': worktime,
                'menuNames': menuNames,
                'menuRoutes': menuRoutes,
            });
        } catch(err) {
            console.error(err.message);
            res.sendStatus(400);
        }
    } else {
        res.sendStatus(401);
    }
});

export default generalRouter;
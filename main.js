const ExcelJS = require('exceljs');
const puppeteer = require('puppeteer');

const zy = require('./data/zy.js') // zy列表，如果过长建议分切分为多个同时进行，之后再进行合并
const SSDM = 11 // 地区：北京

let schList = []
const getAllSchoolList = async ()=>{
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('test');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
   
    // 到页面里面了，找到当前页面的所有学校
    let ret = []
    for(let i = 0; i < 8; i++){  // 8是北京的学校页数
        ret = [...ret, ...await handleGetSchool(page, i*20)]
    }
    schList = ret
    // 先把横坐标去写了
    const rowValues = ['一级', '二级','二级', ...schList]
    sheet.columns = rowValues.map((item, index) => {
        return {
            header: item,
            key: index,
            width: 10
        }
    });
    console.log('开始获取专业列表')
    await mapZyList();
    console.log('开始写入文件')
    workbook.xlsx.writeFile('./results/excels/统计.xlsx');
    console.log('写入完成')
    async function mapZyList() {
        for (let index = 0; index < zy.length; index++) {
            const zyItem = zy[index];
            const zyBroser =await puppeteer.launch({headless: "new"});
            console.log('launch broswer for ', zyItem)
            const rowValues = {
                0: zyItem.mc,
                1: zyItem.mc,
                2: zyItem.dm,
            }
            await mapSchoolPages();
            console.log(rowValues);
            sheet.addRow(rowValues).commit();
            zyBroser.close()
            async function mapSchoolPages() {
                return Promise.all(schList.map(async (item, index) => {
                    let length = await handleGetZy(zyBroser, zyItem.dm, item);
                    rowValues[index+3] = length;
                }));
            }
        }
    }
}
const handleGetSchool = async(page, start)=>{
    await page.goto(`https://yz.chsi.com.cn/sch/search.do?ssdm=${SSDM}&start=${start}`);
    const item =await page.$('.sch-list-container');
    const elent = item.$$eval('.name.js-yxk-yxmc',  nodes => nodes.map(n => {
        return n.innerText
    }))
    return elent
}
const handleGetZy = async(broser, zy, sch)=>{
    const page = await broser.newPage();
    await page.goto(`https://yz.chsi.com.cn/zsml/querySchAction.do?ssdm=${SSDM}&dwmc=${sch}&yjxkdm=${zy}`, {timeout: 0})
    // await page.pdf({path: `./results/pics/${sch}-${zy}.pdf`, format: 'A4'}); // 不再打印
    const item = await page.$('.zsml-zy-filter')
    if(item === null ){
        return new Promise((resolve)=>{
            resolve(0)
            page.close()
        }) 
    }
    const element =await item.$$eval('label',  nodes => nodes.map(n => {
        return n.innerText
    }))
    return new Promise((resolve)=>{
        
        resolve(element.length)
        page.close()
    }) 
}

getAllSchoolList()


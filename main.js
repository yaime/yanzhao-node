const zy = require('./data/zy.js')
const ExcelJS = require('exceljs');

const puppeteer = require('puppeteer');
// 专业我们已经有了，做为纵轴，我们仍然需要一个横轴
let schList = []
const arr = []
const startBroser =async ()=>{
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.setRequestInterception(true)
    
    page.on('request', logRequest)
    page.on('response', async (response) => {
        if(response.url() === 'https://yz.chsi.com.cn/zsml/queryAction.do'){
            console.log('收到返回', await response.text())
        }
    })
    await page.goto('https://yz.chsi.com.cn/zsml/queryAction.do');
    await page.pdf({path: 'hn.pdf', format: 'A4'});
    // 到页面里面了，找到当前页面的所有学校
    const schoolList = await page.$evaluate('#ssdm', el => {
        return el.options.map(item => {
            return {
                name: item.text,
                value: item.value
            }
        })
    })
    await page.close()
}
function logRequest(interceptedRequest) {
    if(interceptedRequest.url() && interceptedRequest.url() === 'https://yz.chsi.com.cn/zsml/queryAction.do'){
        // 如果是请求学校列表的请求，那么我们就转发
        console.log('请求重写', interceptedRequest.url());
        return  interceptedRequest.continue({
            postData:'ssdm=11&dwmc=&mldm=zyxw&mlmc=&yjxkdm=0252&zymc=&xxfs=',
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                ...interceptedRequest.headers()
            }
        });
    }
    return  interceptedRequest.continue();
}
const getAllSchoolList = async ()=>{
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('test');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
   
    // 到页面里面了，找到当前页面的所有学校
    let ret = []
    for(let i = 0; i < 8; i++){  // 8是页数
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
        return Promise.all(zy.map(async (zyItem) => {
            const zyBroser =await puppeteer.launch();
            console.log('新建浏览器 for ', zyItem)
            const rowValues = {
                0: zyItem.mc,
                1: zyItem.mc,
                2: zyItem.dm,
            }
            await mapSchoolPages();
            console.log(rowValues);
            sheet.addRow(rowValues).commit();
            async function mapSchoolPages() {
                return Promise.all(schList.map(async (item, index) => {
                    let length = await handleGetZy(zyBroser, zyItem.dm, item);
                    rowValues[index+3] = length;
                }));
            }
        }))
    }
}
const handleGetSchool = async(page, start)=>{
    await page.goto(`https://yz.chsi.com.cn/sch/search.do?ssdm=11&start=${start}`);
    const item =await page.$('.sch-list-container');
    const elent = item.$$eval('.name.js-yxk-yxmc',  nodes => nodes.map(n => {
        return n.innerText
    }))
    return elent
}
const handleGetZy = async(broser, zy, sch)=>{
    const page = await broser.newPage();
    await page.goto(`https://yz.chsi.com.cn/zsml/querySchAction.do?ssdm=11&dwmc=${sch}&yjxkdm=${zy}`)
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


const {Client}=require("pg");
const crypto=require("crypto");
const USER="4197e225-3723-4082-9b28-0b6e65fcd4c6";
const BOOK="8765897c-1a8c-41ca-82bc-aee87630468e";
const CLIENT="import-real-2026-09-v2";
const ACC={cash:"59815047-a661-419a-aa4e-80325a280bd3",bank:"01f32db5-7e6b-4f9a-a215-ebfb86ad069d",credit:"58801b05-8b99-4dfa-a9fb-1287b84d25eb"};
const CAT={
  breakfast:"08ebeef5-0616-4ac6-bf53-293eaaa18081",
  lunch:"0407247d-f524-4943-a73c-123c419d693f",
  dinner:"2cdd41b5-864f-4b3d-83b4-56e839ece596",
  snack:"1b5f709e-2ae7-408e-be34-1fe34cd027c6",
  transport:"0a986400-8353-4017-af93-d671566f2008",
  moto:"73a0c0af-9ec3-4adb-9be2-342c7d4465a3",
  sport:"392b6d74-aafc-456c-8baa-9ba36d9c99bb",
  phone:"11486044-fabf-4482-ab6c-031e76a97d2a",
  rent:"041690cc-e595-4c1e-b405-1cbd2b384f6d",
  fun:"28be5ba6-3a33-42ea-8b96-72591fbc1bce",
  otherExp:"1320678d-62cb-4a57-a40c-5daa02dc1980",
};
function uuid(){return crypto.randomUUID()}
function now(){return new Date().toISOString()}

// Verified against screenshot daily totals → month expense 24,910
const ROWS=[
  ["expense",76,"2026-09-18","活大","cash","lunch"],
  ["expense",99,"2026-09-18","東來","cash","dinner"],
  ["expense",100,"2026-09-17","加油","cash","moto"],
  ["expense",135,"2026-09-17","東來 雞排","cash","dinner"],
  ["expense",72,"2026-09-17","活大","cash","lunch"],
  ["expense",45,"2026-09-17","吐司","cash","breakfast"],
  ["expense",6220,"2026-09-16","芝良聚餐","bank","dinner"],
  ["expense",130,"2026-09-16","溫州大餛飩","cash","lunch"],
  ["expense",89,"2026-09-16","儲值","bank","phone"],
  ["expense",39,"2026-09-16","麥片","cash","breakfast"],
  ["expense",125,"2026-09-16","豐和 雞腿","cash","dinner"],
  ["expense",115,"2026-09-15","東來鯖魚","cash","dinner"],
  ["expense",250,"2026-09-15","左籐咖哩","cash","lunch"],
  ["expense",10515,"2026-09-15","房租+電費+手續費","bank","rent"],
  ["expense",125,"2026-09-14","東來 雞腿","cash","dinner"],
  ["expense",99,"2026-09-14","東來 特餐","cash","lunch"],
  ["expense",1494,"2026-09-14","保險","bank","moto"],
  ["expense",39,"2026-09-13","全聯 麥片","cash","breakfast"],
  ["expense",100,"2026-09-13","加油","cash","moto"],
  ["expense",300,"2026-09-13","機油+鎖後照鏡","cash","moto"],
  ["expense",110,"2026-09-13","幸福 雙煮菜","cash","dinner"],
  ["expense",100,"2026-09-13","延三","cash","lunch"],
  ["expense",170,"2026-09-12","白鬍子","cash","dinner"],
  ["expense",87,"2026-09-12","7-Eleven","cash","lunch"],
  ["expense",40,"2026-09-12","游泳","cash","sport"],
  ["expense",125,"2026-09-11","東來","cash","dinner"],
  ["expense",92,"2026-09-11","女九餐廳","cash","lunch"],
  ["expense",42,"2026-09-10","麥片","cash","breakfast"],
  ["expense",115,"2026-09-10","咖哩飯","cash","dinner"],
  ["expense",125,"2026-09-10","東來","cash","lunch"],
  ["expense",99,"2026-09-09","東來","cash","lunch"],
  ["expense",125,"2026-09-09","和豐","cash","dinner"],
  ["expense",180,"2026-09-08","海南雞","cash","lunch"],
  ["expense",45,"2026-09-08","吐司","cash","breakfast"],
  ["expense",110,"2026-09-08","雙主菜 幸福","cash","dinner"],
  ["expense",55,"2026-09-07","水果","cash","dinner"],
  ["expense",165,"2026-09-07","潤餅","cash","lunch"],
  ["expense",115,"2026-09-07","東來","cash","dinner"],
  ["expense",78,"2026-09-06","7-Eleven","cash","lunch"],
  ["expense",0,"2026-09-06","水餃+泡麵","cash","dinner"],
  ["expense",42,"2026-09-06","吐司","cash","breakfast"],
  ["expense",376,"2026-09-05","悠遊卡","cash","transport"],
  ["expense",87,"2026-09-05","7-Eleven","cash","dinner"],
  ["expense",40,"2026-09-05","游泳","cash","sport"],
  ["expense",100,"2026-09-05","台鐵便當","cash","lunch"],
  ["expense",115,"2026-09-04","東來 排骨","cash","dinner"],
  ["expense",99,"2026-09-04","東來 特餐","cash","lunch"],
  ["expense",220,"2026-09-03","黃豆黑豆粉","cash","breakfast"],
  ["expense",99,"2026-09-03","東來","cash","dinner"],
  ["expense",0,"2026-09-03","體檢早午餐","cash","lunch"],
  ["expense",120,"2026-09-02","北教大學餐","cash","lunch"],
  ["expense",99,"2026-09-02","東來","cash","dinner"],
  ["expense",135,"2026-09-01","pasta","cash","lunch"],
  ["expense",1088,"2026-09-01","健身理論","cash","sport"],
  ["expense",100,"2026-09-01","麵","cash","dinner"],
  ["expense",45,"2026-09-01","吐司","cash","breakfast"],
];

(async()=>{
  const c=new Client({connectionString:process.env.DB,ssl:{rejectUnauthorized:false}});
  await c.connect();
  const stamp=now();
  // Remove previous bad import + any live Sep rows for clean replace
  await c.query(`update public.transactions set deleted_at=$1, updated_at=$1
    where user_id=$2 and book_id=$3 and deleted_at is null
      and (client_id like 'import-real-2026-09%' or (date>='2026-09-01' and date<'2026-10-01'))`,
    [stamp,USER,BOOK]);

  let expense=0,n=0;
  for(const [type,amount,date,note,account,catKey] of ROWS){
    await c.query(`insert into public.transactions
      (id,user_id,book_id,type,amount,date,note,account_id,category_id,transfer_account_id,updated_at,deleted_at,client_id)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,null,$10,null,$11)`,
      [uuid(),USER,BOOK,type,amount,date,note,ACC[account],CAT[catKey],stamp,CLIENT]);
    n++; expense+=amount;
  }
  const check=await c.query(`select count(*)::int n, coalesce(sum(amount),0)::float expense
    from public.transactions where user_id=$1 and book_id=$2 and deleted_at is null
      and date>='2026-09-01' and date<'2026-10-01'`,[USER,BOOK]);
  console.log(JSON.stringify({inserted:n, computedExpense:expense, verify:check.rows[0], matchHeader: expense===24910},null,2));
  await c.end();
})().catch(e=>{console.error(e);process.exit(1);});

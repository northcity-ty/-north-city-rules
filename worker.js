function J(d,s=200){return new Response(JSON.stringify(d),{status:s,headers:{"content-type":"application/json;charset=UTF-8","cache-control":"no-store"}})}
const S=v=>String(v??""), admin=(r,e)=>!!(e.ADMIN_TOKEN&&r.headers.get("x-admin-token")===e.ADMIN_TOKEN), editor=r=>{const raw=S(r.headers.get("x-admin-name"));try{return decodeURIComponent(raw).trim().slice(0,60)||"運営"}catch{return raw.trim().slice(0,60)||"運営"}};
async function cols(db,t){const x=await db.prepare(`PRAGMA table_info(${t})`).all();return new Set((x.results||[]).map(v=>v.name))}
async function addCols(db,t,defs){const c=await cols(db,t);for(const [n,d] of defs)if(!c.has(n))await db.prepare(`ALTER TABLE ${t} ADD COLUMN ${n} ${d}`).run()}
async function schema(db){
 await addCols(db,"rules",[["keywords","TEXT DEFAULT ''"],["details","TEXT DEFAULT ''"],["details_collapsed","INTEGER DEFAULT 1"],["change_note","TEXT DEFAULT ''"],["new_until","TEXT"],["retired_at","TEXT"],["major_id","INTEGER"],["middle_id","INTEGER"],["is_required","INTEGER DEFAULT 0"],["edited_by","TEXT DEFAULT ''"],["layout_type","TEXT DEFAULT 'text'"],["tags","TEXT DEFAULT ''"]]);
 await db.prepare(`CREATE TABLE IF NOT EXISTS rule_major_titles(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,description TEXT DEFAULT '',is_required INTEGER DEFAULT 0,sort_order INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,edited_by TEXT DEFAULT '')`).run();
 await db.prepare(`CREATE TABLE IF NOT EXISTS rule_middle_titles(id INTEGER PRIMARY KEY AUTOINCREMENT,major_id INTEGER NOT NULL,title TEXT NOT NULL,description TEXT DEFAULT '',is_required INTEGER DEFAULT 0,sort_order INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,edited_by TEXT DEFAULT '')`).run();
 await addCols(db,"rule_major_titles",[["description","TEXT DEFAULT ''"],["is_required","INTEGER DEFAULT 0"],["edited_by","TEXT DEFAULT ''"]]);
 await addCols(db,"rule_middle_titles",[["description","TEXT DEFAULT ''"],["is_required","INTEGER DEFAULT 0"],["edited_by","TEXT DEFAULT ''"]]);
 await db.prepare(`CREATE TABLE IF NOT EXISTS rule_history(id INTEGER PRIMARY KEY AUTOINCREMENT,rule_id INTEGER NOT NULL,title TEXT,category TEXT,summary TEXT,content TEXT,details TEXT,display_type TEXT,is_published INTEGER,change_note TEXT,edited_by TEXT DEFAULT '',saved_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
 await addCols(db,"rule_history",[["edited_by","TEXT DEFAULT ''"]]);
 await db.prepare(`CREATE TABLE IF NOT EXISTS announcements(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,body TEXT NOT NULL,tag TEXT DEFAULT 'NEWS',is_important INTEGER DEFAULT 0,is_published INTEGER DEFAULT 0,image_key TEXT DEFAULT '',sort_order INTEGER DEFAULT 0,published_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,edited_by TEXT DEFAULT '')`).run();
 await db.prepare(`CREATE TABLE IF NOT EXISTS faqs(id INTEGER PRIMARY KEY AUTOINCREMENT,category TEXT DEFAULT '',question TEXT NOT NULL,answer TEXT NOT NULL,is_published INTEGER DEFAULT 0,sort_order INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,edited_by TEXT DEFAULT '')`).run();
 await db.prepare(`CREATE TABLE IF NOT EXISTS site_settings(key TEXT PRIMARY KEY,value TEXT DEFAULT '',updated_at TEXT DEFAULT CURRENT_TIMESTAMP,edited_by TEXT DEFAULT '')`).run();
 await db.prepare(`CREATE TABLE IF NOT EXISTS site_images(id INTEGER PRIMARY KEY AUTOINCREMENT,slot TEXT NOT NULL,title TEXT DEFAULT '',alt_text TEXT DEFAULT '',object_key TEXT NOT NULL,is_published INTEGER DEFAULT 1,sort_order INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,edited_by TEXT DEFAULT '')`).run();
 const defaults={season:"β Season 1",season_note:"Season1終了予定：8月31日",open_time:"15:00 - 05:00",restart_time:"再起動：18:00 / 02:00",crime_time:"18:00 - 02:00",crime_note:"犯罪可能時間",discord_url:"https://discord.gg/hsH6jr42W",x_url:"https://x.com/northcity_ty",hero_title:"ないなら作ればいい",hero_copy:"ストーリー重視の、ゆるっとRP。",important_notice_enabled:"1",important_notice_text:"最新のお知らせを確認する"};
 for(const [k,v] of Object.entries(defaults))await db.prepare(`INSERT OR IGNORE INTO site_settings(key,value) VALUES(?,?)`).bind(k,v).run();
}
async function next(db,t,w="",b=[]){const r=await db.prepare(`SELECT COALESCE(MAX(sort_order),-1)+1 n FROM ${t} ${w}`).bind(...b).first();return +r?.n||0}
async function move(db,t,id,dir,scope=null){const r=await db.prepare(`SELECT * FROM ${t} WHERE id=?`).bind(id).first();if(!r)return;const op=dir==="up"?"<":">",ord=dir==="up"?"DESC":"ASC";let q=`SELECT * FROM ${t} WHERE sort_order ${op} ?`,b=[r.sort_order];if(scope){if(r[scope]==null)q+=` AND ${scope} IS NULL`;else{q+=` AND ${scope}=?`;b.push(r[scope])}}q+=` ORDER BY sort_order ${ord},id ${ord} LIMIT 1`;const o=await db.prepare(q).bind(...b).first();if(o)await db.batch([db.prepare(`UPDATE ${t} SET sort_order=? WHERE id=?`).bind(o.sort_order,r.id),db.prepare(`UPDATE ${t} SET sort_order=? WHERE id=?`).bind(r.sort_order,o.id)])}
function slug(t){return S(t).normalize("NFKC").toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu,"-").replace(/^-+|-+$/g,"").slice(0,80)||`rule-${Date.now()}`}
async function uniq(db,s,t,except=null){let b=S(s).trim()||slug(t),c=b,n=2;while(true){const f=except?await db.prepare("SELECT id FROM rules WHERE slug=? AND id!=?").bind(c,except).first():await db.prepare("SELECT id FROM rules WHERE slug=?").bind(c).first();if(!f)return c;c=`${b}-${n++}`}}
async function hist(db,r,n,e){if(r)await db.prepare(`INSERT INTO rule_history(rule_id,title,category,summary,content,details,display_type,is_published,change_note,edited_by)VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(r.id,r.title||"",r.category||"",r.summary||"",r.content||"",r.details||"",r.display_type||"normal",r.is_published??1,n||"",e).run()}
async function settings(db){const r=await db.prepare("SELECT key,value FROM site_settings").all();return Object.fromEntries((r.results||[]).map(x=>[x.key,x.value]))}
function ext(type){return({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"}[type]||"")}
const OFFICIAL_RULE_STRUCTURE=[
 ["はじめに",["North Cityについて","初心者向け","用語について"]],
 ["基本ルール",["禁止事項","RP上の禁止事項","メタ・外部情報","配信・録画","不正行為・外部ツール","アイテム・車両・施設","バグ・不具合"]],
 ["職業・市民ルール",["ジョブ共通ルール","Job・兼業","オーナー・サブオーナー","違反ポイント","白市民・黒市民","武器ライセンス"]],
 ["犯罪ルール",["犯罪の基本","犯罪区分","犯罪シーン","人質","逃走","指名手配","歪み・再起動"]],
 ["警察ルール",["警察の基本","発砲・制圧","法律・罰金","持ち物検査・押収","車両・装備","警察側の援護射撃","犯罪収束後","市民への補償","警察内部"]],
 ["EMSルール",["EMSの基本","救助・医療","犯罪現場","禁止事項","EMSへの妨害","料金"]],
 ["メカニックルール",["メカニックの基本","開業・運営","業務・修理","禁止事項","閉業・営業停止","料金"]],
 ["店舗・会社ルール",["店舗・会社の基本","設立・開業","営業・運営","禁止事項","責任・閉業"]],
 ["ギャング・組織ルール",["組織の基本","ギャング","その他犯罪組織","組織への加入・脱退","組織間の行動","抗争","組織の禁止事項"]],
 ["補填・トラブル対応・お問い合わせ",["チケット・お問い合わせ","補填","違反報告・トラブル","違反対応"]],
 ["運営規約",[]]
]
async function resetOfficialRules(db,ed){
 await db.batch([
  db.prepare("DELETE FROM rule_history"),
  db.prepare("DELETE FROM rules"),
  db.prepare("DELETE FROM rule_middle_titles"),
  db.prepare("DELETE FROM rule_major_titles")
 ]);
 for(let i=0;i<OFFICIAL_RULE_STRUCTURE.length;i++){
  const [title,middles]=OFFICIAL_RULE_STRUCTURE[i];
  const r=await db.prepare("INSERT INTO rule_major_titles(title,description,is_required,sort_order,edited_by) VALUES(?,?,?,?,?)").bind(title,"",0,i,ed).run();
  const majorId=r.meta.last_row_id;
  for(let j=0;j<middles.length;j++)await db.prepare("INSERT INTO rule_middle_titles(major_id,title,description,is_required,sort_order,edited_by) VALUES(?,?,?,?,?,?)").bind(majorId,middles[j],"",0,j,ed).run();
 }
 return {majors:OFFICIAL_RULE_STRUCTURE.length,middles:OFFICIAL_RULE_STRUCTURE.reduce((n,x)=>n+x[1].length,0)};
}

async function ensureSection(db,majorTitle,middleTitle){
 let ma=await db.prepare("SELECT id FROM rule_major_titles WHERE title=? ORDER BY id LIMIT 1").bind(majorTitle).first();
 if(!ma){const so=await next(db,"rule_major_titles");const r=await db.prepare("INSERT INTO rule_major_titles(title,sort_order,edited_by)VALUES(?,?,?)").bind(majorTitle,so,"初期データ").run();ma={id:r.meta.last_row_id}}
 if(!middleTitle)return [ma.id,null];
 let mi=await db.prepare("SELECT id FROM rule_middle_titles WHERE major_id=? AND title=? ORDER BY id LIMIT 1").bind(ma.id,middleTitle).first();
 if(!mi){const so=await next(db,"rule_middle_titles","WHERE major_id=?",[ma.id]);const r=await db.prepare("INSERT INTO rule_middle_titles(major_id,title,sort_order,edited_by)VALUES(?,?,?,?)").bind(ma.id,middleTitle,so,"初期データ").run();mi={id:r.meta.last_row_id}}
 return [ma.id,mi.id]
}
const INITIAL_RULES=[
["nc-about","はじめに","North Cityについて","North Cityについて","North Cityは、ストーリーを重視しながら、ゆるくRPを楽しむ街です。","勝敗だけではなく、会話や過程、住民同士の関係から生まれる物語を大切にしてください。","text","全住民"],
["beginner-guide","はじめに","初心者向け","初めて街に入る方へ","まずは街の雰囲気や基本ルールを知ることから始めてください。\n\n初心者マークがついている間は犯罪を行うことを禁止します。","text","初心者,全住民"],
["rp-terms","はじめに","用語について","最低限のRP用語","- **心なき**：NPCを指します。\n- **魂抜け（たまぬけ）**：プレイヤーが一時的に離席している状態を指します。\n- **黒市民**：犯罪者を指します。","text","初心者"],
["basic-rules","基本ルール","禁止事項","基本ルール","当サーバーでは、すべての住民が安心してRPを楽しめる環境作りを大切にしています。\n\n- 他プレイヤーへの暴言、誹謗中傷を禁止します\n- 差別的発言、過度な下ネタ、脅迫行為を禁止します\n- 荒らし行為、迷惑行為を禁止します\n- 連投やチャット妨害を禁止します\n- チート、許可のない外部ツール、不正クライアントの使用を禁止します\n- バグやゲーム仕様を悪用する行為を禁止します\n- 運営の指示には従ってください\n- 所持しているライセンスはインベントリに入れ、常に携帯してください","card","全住民"],
["rp-prohibited","基本ルール","RP上の禁止事項","RP上の禁止事項","- **メタ発言**：RP外の情報をRP中に発言する行為\n- **メタ情報の使用**：外部情報をキャラクターの行動に利用する行為\n- **パワーゲーミング**：ゲーム仕様を利用した非現実的な行動\n- **RDM**：理由のない攻撃・殺害行為\n- **コンバットログ**：不利な状況で意図的にログアウトする行為\n- **過度な煽り行為**：RPの範囲を超えて相手を不快にさせる行為\n- **一方的なRP**：相手に選択肢を与えず、展開を押し付ける行為\n\n車両に乗車した状態で銃を撃つドライブバイは禁止です。","card","全住民"],
["meta-external","基本ルール","メタ・外部情報","メタ・外部情報について","RP中は、キャラクターがRP内で知り得た情報をもとに行動してください。\n\nDiscord、配信、SNS、外部VC、画面共有などで得た情報をキャラクターの行動に利用することは禁止です。\n\n声のみで相手を特定する行為、請求書やボスメニュー等を利用して名前を不当に確認する行為も禁止します。\n\n犯罪シーン中の車両ナンバーから個人を特定する行為は許可します。","notice","全住民"],
["private-info","基本ルール","メタ・外部情報","非公開情報の公開禁止","受注場所、精製場所、犯罪獲得金額、隠されている仕様などの非公開情報を、不特定多数が見える場所で公開する行為は禁止です。\n\n取引や街中での情報売買は可能です。","text","全住民"],
["streaming","基本ルール","配信・録画","配信・録画について","配信する場合は、事前にチケットで運営へお知らせください。Discordの宣伝場所は自由に使用できます。\n\n街中にいる状態で配信を見る場合は、配信者から許可を取ってください。配信を見たことを理由に街中での行動を変えることは禁止です。\n\n住民同士で動画や証拠の提出を強要することは禁止です。提出を求めることができるのは運営のみです。","notice","全住民,配信"],
["tools-mods","基本ルール","不正行為・外部ツール","不正行為・外部ツール","スピードブースト、チート、バグやゲーム仕様の悪用は禁止です。\n\nグラフィックMOD、外部ツール・外部ソフトウェアは、**事前に運営の許可を得た場合のみ使用できます。**\n\n武器スキンは使用できます。ただし、レーザーサイトの追加や過度な視認性向上など、戦闘で有利になる変更は禁止です。","warning","全住民"],
["safe-zone","基本ルール","アイテム・車両・施設","セーフゾーンについて","病院、メカニック、飲食店など、営業店舗や公共施設と考えられる**建物内**はセーフゾーンです。\n\nセーフゾーン内では発砲を禁止します。また、逃げ込みを目的とした立ち寄りも禁止です。\n\n警察に限り、制圧を目的としたテーザー銃の使用を許可します。","notice","全住民"],
["job-common","職業・市民ルール","ジョブ共通ルール","ジョブ共通ルール","各ジョブに就くプレイヤーは、その職業に応じた責任を持って行動してください。\n\n犯罪が許可されている職業は、**犯罪準備シーン・犯罪シーン中は退勤**してください。警察・EMS・メカニックなど在籍中の犯罪が禁止されている職業は、各職業の個別ルールを優先します。\n\n放置状態、業務に関係のない行動を継続する場合、音声を聞くことができない状態では出勤を維持しないでください。","card","職業"],
["jobs-combination","職業・市民ルール","Job・兼業","Job数・兼業について","Jobは**最大2つまで**です。\n\n同業他社に所属できるかどうかは、各店舗・会社のオーナー同士の判断とします。\n\n- ギャング × 警察\n- ギャング × EMS\n- ギャング × メカニック\n- メカニック × 警察\n- メカニック × EMS\n- 警察 × EMS\n- ギャング × 犯罪組織\n- メカニック × メカニック\n\n上記の兼業は禁止です。","card","職業"],
["owners","職業・市民ルール","オーナー・サブオーナー","オーナー・サブオーナーについて","会社・店舗の代表者を変更する場合は、事前に運営へ申請し、承認を受ける必要があります。\n\n承認を受けずに営業権や代表権を第三者へ譲渡・貸与することは禁止します。\n\n**オーナー・サブオーナーとして登録できるのは、プレイヤー1人につき1つまでです。**","text","職業,店舗"],
["job-points","職業・市民ルール","違反ポイント","違反ポイント","- **1ポイント**：口頭注意・警告\n- **2ポイント**：責任者判断による処分（業務停止・役職変更・罰金など）\n- **3ポイント**：組織・店舗ルールに基づく最終処分（閉業・営業停止・解散・その他必要な処分）\n\n悪質な違反や故意による不正行為は、ポイントに関係なく即時処分となる場合があります。","card","職業"],
["crime-scenes","犯罪ルール","犯罪シーン","犯罪シーンの区分","## 犯罪準備シーン\n犯罪を行うことを決め、準備を始めた時点から犯罪開始直前まで。\n\n## 犯罪シーン\n犯罪を開始してから犯罪現場を離れるまで。\n\n## 逃走シーン\n犯罪現場を離れた時点から、警察を撒く、またはアジトに逃げ切るまで。\n\n## 指名手配シーン\n警察から指名手配された本人にのみ発生します。自分が指名手配されていない場合、指名手配シーンはありません。","steps","犯罪者"],
["escape-rules","犯罪ルール","逃走","逃走シーンのルール","- **逃走開始から5分間はアジト逃げ禁止**\n- **逃走開始から10分間は、盗品・押収品を車に収納する行為禁止**\n- **逃走シーン終了後は、犯罪で使用した服装以外に着替えること**","warning","犯罪者"],
["white-citizen","職業・市民ルール","白市民・黒市民","白市民・黒市民について","武器ライセンスを所持している場合は白市民として扱います。\n\n黒市民は犯罪者を指します。","text","全住民"],
["law-fines","警察ルール","法律・罰金","法律・罰金一覧","サーバー内ではRP上の法律が存在します。警察は法律に基づいて取り締まりを行い、市民はその場のRPとして対応してください。\n\n- 詐欺罪：60万円\n- 虚偽罪：50万円\n- 暴行罪：50万円\n- 威力業務妨害罪：300万円\n- 営業妨害罪：100万円（被害施設は0〜1億円の損害賠償を請求できる権利があります）\n- 公然わいせつ罪：250万円\n- 銃刀法違反：30万円\n- 窃盗罪：100万円\n- 重窃盗罪（公務員車両）：200万円\n- 違法薬物所持罪：20万円（1個単位）\n- 違法薬物素材所持罪：20万円（100個ごと）\n- 道路交通法違反：30万円\n- 逃走ほう助罪：150万円\n- 誘拐・拉致罪：50万円\n- 殺人罪：100万円\n- 公務執行妨害罪：50万円\n- 準小型犯罪：300万円\n- 小型犯罪：500万円\n- 中型犯罪：1,500万円\n- 準大型犯罪：2,000万円\n- 大型犯罪：3,000万円\n- 超大型犯罪：4,000万円\n- 本署襲撃罪：2,000万円\n- 本署テロ罪：2億円\n- テロ罪：3億円\n- イベントテロ罪：3億円\n\n**殺した場合は、プレイヤー・NPCを問わず殺人罪となります。**","card","全住民,警察"],
["police-basic","警察ルール","警察の基本","警察について","警察は、市民を守る立場として常に節度ある行動を心がけてください。\n\n市民・犯罪者を問わず丁寧な言葉遣いで対応し、不明点や判断に迷う場合は**上官に確認してください。**","text","警察"],
["police-fire","警察ルール","発砲・制圧","発砲基準","- 人質がいない場合、犯人が武器を所持していることを確認した時点で制圧行為が可能\n- 無抵抗の相手には、必ず警告を行ってから発砲すること\n- 小型犯罪は、犯人が警察に対して発砲した場合のみ発砲可能\n- 中型犯罪以上は即時発砲可能","card","警察"],
["seizure","警察ルール","持ち物検査・押収","持ち物検査・押収","銃弾は押収対象外です。\n\n★マーク付きアイテムは、警察が押収対象として認識しているものです。\n\n犯罪に使用した物品、盗品、登録されていない武器、警察が危険と判断した物品などは押収される場合があります。\n\n押収機能を利用した物資共有、押収品の使用、押収権限の悪用は禁止です。","notice","警察"],
["ems-basic","EMSルール","EMSの基本","救急隊について","救急隊は、倒れたプレイヤーの救助や医療RPを担当する職業です。\n\n救助対象には公平に対応し、医療RPを大切にしてください。救急隊権限を悪用してはいけません。\n\n**EMSは出勤・退勤を問わず犯罪行為は禁止です。**","card","EMS"],
["ems-prohibited","EMSルール","禁止事項","救急隊の禁止事項","- 救急アイテムの横流し\n- 特定プレイヤーのみを優遇する行為\n- 犯罪者への不正な協力\n- 現場情報を外部へ漏らす行為\n- 救助RPを無視した機械的な蘇生のみ\n- 無償での蘇生や治療、AFAKの提供行為","card","EMS"],
["company-setup","店舗・会社ルール","設立・開業","会社・店舗の設立","会社の設立には、市長面談により営業許可を受けた後、営業ライセンスを取得する必要があります。\n\n- 従業員3名以上\n- 設立費用：**￥30,000,000**\n- 既存MLOの利用可\n- MLOを新規導入する場合は、設立費用とは別に費用がかかります","card","店舗,会社"],
["company-operation","店舗・会社ルール","営業・運営","店舗・会社の運営","店舗を運営する場合は、営業内容に合ったRPを行ってください。価格設定、販売物、営業日、接客方針など、ルールに記載のものを遵守してください。\n\n**業種以外の商品を取り扱う場合は、再度市との面談が必要です。**","text","店舗,会社"],
["ticket","補填・トラブル対応・お問い合わせ","チケット・お問い合わせ","チケットについて","サーバー内で困ったこと、質問、報告、申請がある場合はチケットを使用してください。DMでの個別対応は原則行いません。\n\n状況が分かるように、発生日時・関係者・発生場所・内容などを記載してください。補填や違反報告では証拠が必要となり、**基本的に動画での提出**をお願いします。","text","全住民"],
["violation-response","補填・トラブル対応・お問い合わせ","違反対応","違反対応について","ルール違反が確認された場合、内容に応じて注意、警告、一時的な制限、アイテム・金銭・権限の回収、職業・会社・ギャング権限の停止、一時BAN、永久BANなどの対応を行う場合があります。\n\n最終的な判断は運営が行います。ルールに明記されていない行為でも、サーバー運営に支障があると判断した場合は対応対象となります。","notice","全住民"],
["admin-regulations","運営規約",null,"運営チーム内部規約","第1条（目的）\n本規約は、運営チームとして公平かつ円滑なサーバー運営を行うために必要な行動基準および遵守事項を定めることを目的とする。\n\n第2条（基本方針）\n1. 運営メンバーは、常に公平かつ中立な立場で対応しなければならない。\n2. 個人的な感情や人間関係によって対応内容を変更してはならない。\n3. サーバー全体の利益を優先し、運営として責任ある行動を取らなければならない。\n\n第3条（守秘義務）\n1. 運営活動を通じて知り得た内部情報、開発情報、個人情報その他の機密情報を、運営全体の許可なく第三者へ開示してはならない。\n2. 運営権限によって知り得た情報を私的な目的で利用してはならない。\n\n第4条（権限の行使）\n1. 運営権限は、サーバー運営に必要な範囲でのみ使用しなければならない。\n2. 権限を私的な目的や特定のプレイヤーを優遇または不利益に扱う目的で使用してはならない。\n3. テストを目的として権限を使用する場合は、運営チーム内で共有し、必要に応じて適切な環境で実施するものとする。\n4. 権限をロールプレイキャラクターで使用することは認められない。使用する場合は必ずキャラクターを変更して使用しなければならない。\n\n第5条（プレイヤー対応）\n1. プレイヤーへの対応は、常に冷静かつ丁寧に行わなければならない。\n2. 暴言、煽り、威圧的な発言その他運営として不適切な言動を行ってはならない。\n3. 問題が発生した場合は、事実確認を優先し、憶測や一方的な判断による対応を行ってはならない。\n\n第6条（運営内での連携）\n1. サーバー運営に重大な影響を及ぼす対応を行う場合は、可能な限り他の運営メンバーへ情報共有を行うものとする。\n2. 判断が困難な案件については、独断で対応せず、運営チーム内で協議を行うものとする。\n\n第7条（禁止事項）\n1. 権限の私的利用\n2. 内部情報の漏えい\n3. プレイヤーへの差別的対応\n4. 個人的な理由による処罰または優遇\n5. 運営権限を利用した利益の取得\n6. 他の運営メンバーの信用を不当に損なう行為\n7. サーバー運営に支障を及ぼす行為\n\n第8条（責任）\n運営メンバーは、自らの判断および行動に責任を負い、問題が発生した場合は速やかに運営チームへ報告しなければならない。\n\n第9条（規約違反）\n本規約に違反した場合は、その内容および重大性を考慮し、警告、権限の制限または剥奪、運営チームからの除名その他必要な措置を講じる場合がある。\n\n第10条（規約の改定）\n本規約は、サーバー運営上必要と判断した場合、運営責任者または管理者の判断により改定できるものとする。\n\n第11条（開発成果物の取扱い）","text","運営"]
];
async function normalizeOfficialStructure(db){
 // Ensure the 11 current major titles exist and keep this exact default order.
 const ids={};
 for(let i=0;i<OFFICIAL_RULE_STRUCTURE.length;i++){
  const title=OFFICIAL_RULE_STRUCTURE[i][0];
  let ma=await db.prepare("SELECT id FROM rule_major_titles WHERE title=? ORDER BY id LIMIT 1").bind(title).first();
  if(!ma){const r=await db.prepare("INSERT INTO rule_major_titles(title,sort_order,edited_by)VALUES(?,?,?)").bind(title,i,"構成更新").run();ma={id:r.meta.last_row_id}}
  ids[title]=ma.id;
  await db.prepare("UPDATE rule_major_titles SET sort_order=? WHERE id=?").bind(i,ma.id).run();
 }
 async function targetMiddle(major,title){
  let mi=await db.prepare("SELECT id FROM rule_middle_titles WHERE major_id=? AND title=? ORDER BY id LIMIT 1").bind(ids[major],title).first();
  if(!mi){const so=await next(db,"rule_middle_titles","WHERE major_id=?",[ids[major]]);const r=await db.prepare("INSERT INTO rule_middle_titles(major_id,title,sort_order,edited_by)VALUES(?,?,?,?)").bind(ids[major],title,so,"構成更新").run();mi={id:r.meta.last_row_id}}
  return mi.id;
 }
 const oldLic=await db.prepare("SELECT id FROM rule_major_titles WHERE title='ライセンス'").first();
 if(oldLic){
  const mids=await db.prepare("SELECT * FROM rule_middle_titles WHERE major_id=? ORDER BY sort_order,id").bind(oldLic.id).all();
  for(const mi of mids.results||[]){const dst=mi.title.includes("営業")?await targetMiddle("店舗・会社ルール","設立・開業"):await targetMiddle("職業・市民ルール","武器ライセンス");await db.prepare("UPDATE rules SET major_id=?,middle_id=? WHERE major_id=? AND middle_id=?").bind(mi.title.includes("営業")?ids["店舗・会社ルール"]:ids["職業・市民ルール"],dst,oldLic.id,mi.id).run()}
  await db.prepare("UPDATE rules SET major_id=?,middle_id=? WHERE major_id=? AND middle_id IS NULL").bind(ids["職業・市民ルール"],await targetMiddle("職業・市民ルール","武器ライセンス"),oldLic.id).run();
  await db.prepare("DELETE FROM rule_middle_titles WHERE major_id=?").bind(oldLic.id).run();await db.prepare("DELETE FROM rule_major_titles WHERE id=?").bind(oldLic.id).run();
 }
 const oldFee=await db.prepare("SELECT id FROM rule_major_titles WHERE title='料金'").first();
 if(oldFee){
  const mids=await db.prepare("SELECT * FROM rule_middle_titles WHERE major_id=? ORDER BY sort_order,id").bind(oldFee.id).all();
  for(const mi of mids.results||[]){let ma="職業・市民ルール",mt="ジョブ共通ルール";if(mi.title.includes("EMS")){ma="EMSルール";mt="料金"}else if(mi.title.includes("メカニック")){ma="メカニックルール";mt="料金"}else if(mi.title.includes("店舗")||mi.title.includes("会社")){ma="店舗・会社ルール";mt="設立・開業"}const dst=await targetMiddle(ma,mt);await db.prepare("UPDATE rules SET major_id=?,middle_id=? WHERE major_id=? AND middle_id=?").bind(ids[ma],dst,oldFee.id,mi.id).run()}
  const dst=await targetMiddle("職業・市民ルール","ジョブ共通ルール");await db.prepare("UPDATE rules SET major_id=?,middle_id=? WHERE major_id=? AND middle_id IS NULL").bind(ids["職業・市民ルール"],dst,oldFee.id).run();
  await db.prepare("DELETE FROM rule_middle_titles WHERE major_id=?").bind(oldFee.id).run();await db.prepare("DELETE FROM rule_major_titles WHERE id=?").bind(oldFee.id).run();
 }
}
async function seedInitialRules(db){
 for(const r of INITIAL_RULES){const [sl,ma,mi,title,content,layout,tags]=r;const exists=await db.prepare("SELECT id FROM rules WHERE slug=? LIMIT 1").bind(sl).first();if(exists)continue;const [majorId,middleId]=await ensureSection(db,ma,mi);const so=await next(db,"rules",middleId?"WHERE middle_id=?":"WHERE middle_id IS NULL",middleId?[middleId]:[]);await db.prepare(`INSERT INTO rules(slug,category,title,summary,content,display_type,is_published,sort_order,keywords,details,details_collapsed,change_note,new_until,major_id,middle_id,is_required,edited_by,layout_type,tags,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).bind(sl,ma,title,"",content,"normal",1,so,"","",1,"初期ルール追加",null,majorId,middleId,0,"初期データ",layout,tags).run()}
}


const RULE_CONTENT_V3=[
["basic-rules","基本ルール","禁止事項","基本ルール",`当サーバーでは、すべての住民が安心してRPを楽しめる環境作りを大切にしています。\n\n他プレイヤーへの迷惑行為や、RPの雰囲気を壊す行為は禁止です。\n\n- 他プレイヤーへの暴言、誹謗中傷を禁止します\n- 差別的発言、過度な下ネタ、脅迫行為を禁止します\n- 荒らし行為、迷惑行為を禁止します\n- 連投やチャット妨害を禁止します\n- チート、許可のない外部ツール、不正クライアントの使用を禁止します\n- バグやゲーム仕様を悪用する行為を禁止します\n- 運営の指示には従ってください\n- 所持しているライセンスはインベントリに入れ、常に携帯してください\n\n**補足**\n他人が不快になる発言や行動は禁止です。RP上の発言であっても、相手や周囲への配慮を忘れないようにしてください。`,"card","全住民"],
["rp-prohibited","基本ルール","RP上の禁止事項","RP上の禁止事項",`RP中は、キャラクターとして自然な行動を心がけてください。\n\n- **メタ発言**：RP外の情報をRP中に発言する行為\n- **メタ情報の使用**：外部情報をキャラクターの行動に利用する行為\n- **パワーゲーミング**：ゲーム仕様を利用した非現実的な行動\n- **RDM**：理由のない攻撃・殺害行為\n- **コンバットログ**：不利な状況で意図的にログアウトする行為\n- **過度な煽り行為**：RPの範囲を超えて相手を不快にさせる行為\n- **一方的なRP**：相手に選択肢を与えず、展開を押し付ける行為\n\n## RDM禁止\n犯罪シーンと関係のない、RP上の理由がない攻撃・殺害は禁止です。「敵対している」「犯罪者である」という理由だけで、いつでも攻撃してよいわけではありません。\n\n## NFFCについて\n**正式名称：Not Fit For Community**\n\nマナーやモラルの欠如、プレイヤーまたは運営への過度な誹謗中傷、街中・SNS等を含む不適切な言動、一方的な主張の押し付け、ルールのグレーゾーンを探る行為など、コミュニティに不適切と判断される行動はNFFCの対象となる場合があります。\n\n強制RP、過度な拘束、価値観の強制、一方的なRPなど、相手がRPを返す余地を失う行為は禁止です。\n\n## ドライブバイ禁止\n車両に乗車した状態で銃を撃つ行為は禁止です。ボートなどで座席に座らずにいる状況での発砲は可能です。\n\n## パワーゲーミング禁止\n侵入不可エリアへの侵入、パルクール中の射撃、降車・転倒・落下モーションの不自然なキャンセル、エモートによる不自然な遮蔽、松葉杖中の運転、落下ダメージの不自然な無効化、透明化する服装、ギミック無効化などは禁止です。\n\n## コンバットログ禁止\n戦闘中・犯罪中・警察対応中・救急対応中・拘束中などに意図的にログアウトする行為は禁止です。回線落ちやクラッシュなど意図しない切断は速やかに報告してください。\n\n## その他\n正当な理由のない請求、ハラスメント、差別・攻撃的発言は禁止です。初心者マーク中の犯罪は禁止します。`,"text","全住民"],
["meta-external","基本ルール","メタ・外部情報","メタ・外部情報について",`RP中は、キャラクターがRP内で知り得た情報をもとに行動してください。\n\nDiscord、配信、SNS、外部VC、画面共有などで得た情報を、キャラクターの行動に利用することは禁止です。\n\n## メタ情報の使用禁止\nDiscordで見た犯罪情報、配信で見た位置情報、外部VCで聞いた警察情報、画面共有で見た所持品や場所、別キャラクターで得た情報などをRP内で使用してはいけません。\n\nRP内で聞いた情報、街中で実際に見た情報、キャラクター同士の会話で得た情報は使用可能です。\n\n## 声やシステムで個人を特定する行為\n声のみで相手を特定する行為、請求書やボスメニュー等を利用して名前を不当に確認する行為は禁止です。\n\n犯罪シーン中の車両ナンバーから個人を特定する行為は許可します。`,"notice","全住民"],
["resident-evidence","基本ルール","配信・録画","住民同士の動画提出について",`住民同士のトラブルにおいて、動画提出や証拠提出を強要する行為は禁止です。\n\n動画提出、いわゆるボディカメラの提出を求めることができるのは運営のみです。街中のトラブルは、まず街中の会話で解決してください。住民同士で解決できない場合はチケットでご連絡ください。`,"notice","全住民"],
["tools-mods","基本ルール","不正行為・外部ツール","不正行為・外部ツール",`スピードブースト、チート、バグやゲーム仕様を悪用する行為は禁止です。\n\nNoProp、NoWater、Tracer、BloodFX、戦闘面に影響するキルエフェクト変更、許可されていないGTA5本体・FiveMファイルの改変、citizenファイルへの追加・改変は禁止です。\n\n## グラフィックMOD・外部ツール\nReshade、NVE、QuantV等のグラフィックMOD、外部ツール・外部ソフトウェア、ボイスチェンジャー等の音声変更は、**事前に運営の許可を得た場合のみ使用可能**です。\n\n許可を得た場合でも、視認性向上や戦闘面で有利になる設定、壁や人などの当たり判定を消す設定は禁止です。\n\n## 武器スキン\n武器スキンは使用可能です。ただし、レーザーサイトの追加、過度な視認性向上など、他プレイヤーに対して視覚面・戦闘面で優位性をもたらす変更は禁止です。`,"warning","全住民"],
["ghosting","基本ルール","配信・録画","ゴースティング・配信者への迷惑行為",`配信者本人に許可されていない状態で、街中にいるリアルタイム中に配信を見る行為は禁止です。配信を見て位置や犯罪・警察対応の状況を把握したり、その情報を共有したり、行動を変えることも禁止します。\n\nイベントなど、配信者から許可されている配信のみ街中で見ても問題ありません。\n\n配信者の活動を妨害する行為、配信上で使用できない音源や映像を使用する行為など、配信者に不利益が発生する行為は禁止です。`,"warning","全住民,配信"],
["safe-zone","基本ルール","アイテム・車両・施設","セーフゾーンについて",`病院、メカニック、飲食店など、営業店舗や公共施設と考えられる**建物内**はセーフゾーンです。\n\nセーフゾーン内では発砲行為を禁止します。また、逃げ込みを目的とした犯罪中・逃走中の立ち寄りも禁止です。\n\n警察に限り、セーフゾーン内での制圧を目的としたテーザー銃の使用を許可します。`,"notice","全住民"],
["job-vehicles-items","基本ルール","アイテム・車両・施設","ジョブ専用車両・アイテムROB",`ジョブ専用車両を窃盗することは禁止です。ただし、警察車両はこの限りではありません。\n\n他人のインベントリ内アイテムや車両内アイテムをROBする行為は禁止です。警察による押収行為はこの限りではありません。`,"text","全住民"],
["loopholes","基本ルール","禁止事項","ルールの抜け穴利用禁止",`ルールの抜け穴を見つけて悪用する行為、グレーゾーンを意図的に探る行為、ルールに明記されていないことを理由に不適切な行動をすることは禁止です。\n\n**「書いていないからOK」ではありません。** 分からないことがある場合は運営に確認してください。`,"warning","全住民"],
["crime-basic","犯罪ルール","犯罪の基本","犯罪の基本ルール",`- 犯罪を受注した場合は**20分以内に開始**してください。\n- 同一組織が中型犯罪以上を同時に実行することは禁止です。\n- 傭兵は最大4人までです。主体となる組織の人数を超えることはできません。\n- 合同犯罪は追加1組織までです。合同犯罪では傭兵を使用できません。\n- 当事者以外が犯罪・警察対応へ介入することは禁止です。`,"card","犯罪者"],
["crime-cooldown-list","犯罪ルール","犯罪区分","犯罪一覧・個人クールタイム",`犯罪は、下記の人数制限を守って実行してください。\n\n**個人クールタイムは各犯罪一律30分**です。\n\nクールタイムは、以下のタイミングで発生します。\n- 自身が警察の追跡を逃れ、服を着替えたタイミング\n- 警察に捕まり、プリズンに送られたタイミング\n\n| 犯罪名 | PD人数 | 犯罪者人数 | PDヘリ | 犯罪者ヘリ | 特殊ルール | 区分 |\n| --- | --- | --- | --- | --- | --- | --- |\n| 密輸品強盗 | 0〜3 | 1〜2 | - | - | ピストルのみ（単発のみ） | 準小型犯罪 |\n| コンビニ強盗 | 2〜3 | 1〜2 | - | - | **人質可** / ピストルのみ（単発のみ） | 準小型犯罪 |\n| 空き巣強盗 | 2〜3 | 1〜2 | - | - | ピストルのみ（単発のみ） | 準小型犯罪 |\n| 薬物売買 | 3〜10 | 1〜7 | 1 | - | ピストルのみ（単発のみ） | 小型犯罪 |\n| フリーカ銀行強盗 | 3〜5 | 1〜2 | 1 | - | **人質可** / ピストルのみ（単発のみ） | 小型犯罪 |\n| テルミット強盗 | 5〜9 | 3〜7 | 1 | 1 | - | 中型犯罪 |\n| 宝石店強盗 | 5〜9 | 3〜7 | 1 | 1 | - | 中型犯罪 |\n| 客船強盗 | 6〜12 | 4〜10 | 3 | 2 | - | 準大型犯罪 |\n| 精肉店強盗 | 6〜12 | 4〜10 | 3 | 2 | - | 準大型犯罪 |\n| 陸上オイルリグ | 7〜15 | 6〜12 | 3 | 2 | - | 大型犯罪 |\n| 飛行場強盗 | 7〜15 | 6〜12 | 3 | 2 | - | 大型犯罪 |\n| ヒューメイン強盗 | 12〜23 | 9〜20 | 4 | 3 | **合同禁止** | 超大型犯罪 |\n\n**注意事項**\n- 小型犯罪は、物品を全て回収してから逃走してください。\n- 犯罪者側のヘリ使用は、中型犯罪から可能です。\n- 「人質可」の表示がある犯罪は、人質可能犯罪です。`,"text","犯罪者"],
["down-revive","犯罪ルール","犯罪シーン","ダウン・蘇生・再参加",`犯罪シーン等でダウンし、蘇生された場合は**同じシーンへ復帰できません**。\n\nダウン後に現場へ戻る行為や、現場を観戦する行為も禁止です。`,"warning","全住民,犯罪者,警察"],
["distortion-restart","犯罪ルール","歪み・再起動","強制瞑想・歪み・復帰",`追われている最中に強制瞑想となった場合は、そのシーンを一時停止し、復帰後に再開します。\n\n中型犯罪以上は、復帰した場合も犯罪継続扱いとします。\n\n歪みが発生した場合は、**発生時に使用していた移動手段で、5分以内に自力で現場へ戻った場合のみ復帰可能**です。`,"notice","犯罪者,警察"],
["mechanic-setup","メカニックルール","開業・運営","メカニック開業",`メカニックを開業する場合は、市の営業許可および営業ライセンスが必要です。\n\n- 従業員：**5名以上**\n- 開業費：**3億円**\n- MLO費用：**別途**`,"card","メカニック"],
["mechanic-engine-swap","メカニックルール","料金","エンジンスワップ料金",`| エンジン | 料金 |\n| --- | ---: |\n| I4 | 4,000万円 |\n| V6 | 6,000万円 |\n| V8 | 8,000万円 |\n| V12 | 1億2,000万円 |\n\n**エンジンスワップは白市民3割引の対象外です。**`,"text","メカニック,全住民"],
["admin-regulations","運営規約",null,"運営チーム内部規約",`第1条（目的）\n\n本規約は、運営チームとして公平かつ円滑なサーバー運営を行うために必要な行動基準および遵守事項を定めることを目的とする。\n\n第2条（基本方針）\n\n1. 運営メンバーは、常に公平かつ中立な立場で対応しなければならない。\n2. 個人的な感情や人間関係によって対応内容を変更してはならない。\n3. サーバー全体の利益を優先し、運営として責任ある行動を取らなければならない。\n\n第3条（守秘義務）\n\n1. 運営活動を通じて知り得た内部情報、開発情報、個人情報その他の機密情報を、運営全体の許可なく第三者へ開示してはならない。\n2. 運営権限によって知り得た情報を私的な目的で利用してはならない。\n\n第4条（権限の行使）\n\n1. 運営権限は、サーバー運営に必要な範囲でのみ使用しなければならない。\n2. 権限を私的な目的や特定のプレイヤーを優遇または不利益に扱う目的で使用してはならない。\n3. テストを目的として権限を使用する場合は、運営チーム内で共有し、必要に応じて適切な環境で実施するものとする。\n4. 権限をロールプレイキャラクターで使用することは認められない。使用する場合は必ずキャラクターを変更して使用しなければならない。\n\n第5条（プレイヤー対応）\n\n1. プレイヤーへの対応は、常に冷静かつ丁寧に行わなければならない。\n2. 暴言、煽り、威圧的な発言その他運営として不適切な言動を行ってはならない。\n3. 問題が発生した場合は、事実確認を優先し、憶測や一方的な判断による対応を行ってはならない。\n\n第6条（運営内での連携）\n\n1. サーバー運営に重大な影響を及ぼす対応を行う場合は、可能な限り他の運営メンバーへ情報共有を行うものとする。\n2. 判断が困難な案件については、独断で対応せず、運営チーム内で協議を行うものとする。\n\n第7条（禁止事項）\n\n運営メンバーは、次の各号に掲げる行為を行ってはならない。\n\n1. 権限の私的利用\n2. 内部情報の漏えい\n3. プレイヤーへの差別的対応\n4. 個人的な理由による処罰または優遇\n5. 運営権限を利用した利益の取得\n6. 他の運営メンバーの信用を不当に損なう行為\n7. サーバー運営に支障を及ぼす行為\n\n第8条（責任）\n\n運営メンバーは、自らの判断および行動に責任を負い、問題が発生した場合は速やかに運営チームへ報告しなければならない。\n\n第9条（規約違反）\n\n本規約に違反した場合は、その内容および重大性を考慮し、警告、権限の制限または剥奪、運営チームからの除名その他必要な措置を講じる場合がある。\n\n第10条（規約の改定）\n\n本規約は、サーバー運営上必要と判断した場合、運営責任者または管理者の判断により改定できるものとする。\n\n第11条（開発成果物の取扱い）\n\n1. 運営メンバーがサーバー運営に関連して開発、制作、修正または導入したソースコード、スクリプト、設定ファイル、画像、UI、データその他一切の成果物は、特段の合意がある場合を除き、本サーバーの保有物とする。\n2. 開発途中のソースコードおよび未完成の成果物についても、本サーバーの運営を目的として作成されたものである場合は、本サーバーの保有物とする。\n3. 運営メンバーが自ら制作した成果物については、個人の販売サイトその他これに準ずるサービスにおいて販売することを認める。ただし、本サーバー専用として制作された機密情報、独自システム、設定情報その他本サーバーの運営に支障を及ぼす内容を含む場合は、この限りではない。\n4. 一度本サーバーへ導入した成果物については削除してはならない。\n5. 運営メンバーは、本サーバーで使用されている成果物について、運営責任者から求められた場合は、最新版を引き継ぎ可能な状態で提出しなければならない。\n\n第12条（規約への同意）\n\n開発サーバーへの参加権限を付与された者は、本規約の内容を確認し、これに同意したものとみなすものとする。また、参加権限を保持している期間中は、本規約を遵守する義務を負うものとする。`,"text","運営"]
];


const RULE_CONTENT_V4=[
["nc-about","はじめに","North Cityについて","North Cityについて",`North Cityは、ストーリーや交流を大切にする「ゆるっとRPサーバー」です。

この街では、勝敗だけを目的とするのではなく、RPの過程や、そこで生まれる出来事、住民同士の関係性を楽しむことを大切にしています。

初心者から経験者まで、さまざまな住民が参加します。RPの知識や経験には差があることを前提に、互いに配慮しながら街での生活を楽しんでください。

## 参加にあたって
North Cityに参加した時点で、本ルールに同意したものとみなします。

参加前に必ずルールを確認し、内容を理解したうえで参加してください。ルールを確認していなかった場合でも、違反行為が確認された際は、運営判断により注意・警告・処分の対象となる場合があります。

## 参加条件
- 日本語で基本的なコミュニケーションが取れること
- サーバールールを理解し、遵守できること
- 他プレイヤーと協力しながらRPを楽しめること
- 運営からの連絡・アナウンスを確認できること
- **18歳以上であること**

分からないことや困ったことがある場合は、自己判断で進めず、チケットにて運営へご相談ください。

## サーバー基本情報
| 項目 | 内容 |
| --- | --- |
| サーバー名 | North City |
| 開放時間 | 15:00 ～ 翌05:00 |
| 再起動時間 | 18:00 / 02:00 |
| 犯罪可能時間 | 18:00 ～ 02:00 |

**再起動前後15分間は犯罪行為を禁止します。**

再起動15分前の通知が出た時点で、進行中の犯罪は原則として警察（PD）側勝利扱いとします。通知後に犯罪行為を継続した場合、運営判断により注意・警告・処分の対象となる場合があります。

犯罪RPを行う場合は、必ず犯罪可能時間と再起動時間を確認してください。

## North Cityで大切にしてほしいこと
- 自分だけでなく、相手も楽しめるRPを心がける
- 勝ち負けよりも、ストーリーや流れを大切にする
- 相手のRPやキャラクターを尊重する
- 初心者や新規住民にも優しく接する
- トラブル時は感情的にならず、落ち着いて対応する
- サーバー全体が楽しめる行動を心がける

## RPと中の人の切り分けについて
中の人同士の会話は可能です。

ただし、キャラクターとしての発言や行動は、そのキャラクターがRP内で知り得た情報を基準に行ってください。Discord、配信、SNS、外部VCなどで得た情報や、中の人しか知らない情報をキャラクターの行動に利用することは禁止します。

外部情報の詳しい扱いは、基本ルール内の「メタ・外部情報」「配信・録画」「不正行為・外部ツール」も確認してください。

## トラブルが起きた場合
RP中にトラブルや認識の違いが発生した場合は、感情的にならず、まずは落ち着いて対応してください。

街中で解決できる内容は、RPや会話の流れを大切にしながら対応してください。当事者同士で解決が難しい場合、ルール違反の可能性がある場合、街外での粘着行為などがある場合は、チケットにて運営へご相談ください。

住民同士で動画提出や証拠提出を強要する行為は禁止します。動画提出や確認が必要な場合は、運営が判断します。

## 最後に
North Cityは、ゆるっとした雰囲気でRPを楽しめる街を目指しています。

ただし、ゆるっとRPサーバーであっても、ルール違反や他プレイヤーへの迷惑行為が認められるわけではありません。

すべての住民が安心してRPを楽しめるよう、ルールを確認し、相手への配慮を忘れずに行動してください。

ルールに記載がない内容であっても、街の雰囲気や他住民の体験を大きく損なうと運営が判断した場合、注意・警告・処分の対象となる場合があります。`,"text","全住民"],
["beginner-guide","はじめに","初心者向け","初心者向け",`当サーバーでは、全員が楽しくRPを行える環境作りを大切にしています。

RPは一人で完結するものではなく、相手がいて成立するものです。自分だけが得をする行動、相手のRPを一方的に潰す行動、会話や状況を無視した行動は避けてください。

## RPで大切にしてほしいこと
- 相手にもRPを返す余地を残す
- 会話や状況を大切にする
- 現実ではなく、キャラクターとして行動する
- 負けるRP、失敗するRPも楽しむ
- サーバー全体が楽しめる流れを大切にする

**RPは「勝つこと」だけが目的ではありません。** その場の会話や展開、住民同士の関係性を楽しむことも大切です。

## 楽しみ方
特別なことをしなくても、日常の中でRPは生まれます。

仕事をしてお金を稼ぐ、飲食店で会話をする、誰かと知り合う、事件に巻き込まれるなど、小さな出来事もキャラクターの物語になります。

RPに正解はありません。自分のキャラクターらしさを大切にしながら、相手のRPにも反応を返していきましょう。

- 市民生活を楽しむ
- 仕事やアルバイトを通して交流する
- 飲食店や店舗で会話を楽しむ
- 住民同士の関係性を作る
- トラブルや失敗もRPとして楽しむ
- キャラクターの目標や生活スタイルを作る
- 周囲のRPに反応し、会話や展開を広げる

何をすればいいか分からない場合は、まず街を歩いてみたり、仕事を体験したり、飲食店や人が集まる場所に行ってみるのがおすすめです。

## 初心者の方へ
初心者の方は、分からないことがあるのが普通です。最初から完璧なRPをする必要はありません。

ただし、分からないまま危険な行動や犯罪RPを行うと、トラブルにつながる場合があります。不安な場合は、まず市民生活・職業体験・交流RPなどから始めることを推奨します。

**初心者マークが付いている間は、犯罪行為を禁止します。**

## 初心者が避けるべき行動
| 避けるべき行動 | 理由 |
| --- | --- |
| ルールを読まずに犯罪を始める | トラブルやルール違反につながる可能性があります |
| 警察や救急隊への過度な妨害 | 他プレイヤーの職業RPを妨げる可能性があります |
| 他プレイヤーへの強引な絡み | 相手がRPを返しづらくなる場合があります |
| 知識がない状態でギャングや犯罪組織に入る | 犯罪ルールや組織ルールの理解が必要です |
| 現実の知識をそのままRPに持ち込む | メタ行為やRP崩れにつながる場合があります |

## 分からない時の対応
- ルールページを確認する
- Discordのお知らせを確認する
- 周囲のプレイヤーにRP内で聞く
- チケットで運営に質問する

自己判断で進めて問題が起きた場合、ルール違反として対応される場合があります。不安な場合は、事前に確認してください。`,"text","初心者,全住民"],
["beginner-crime-prohibited","基本ルール","禁止事項","初心者マーク中の犯罪禁止",`初心者マークが付いている間は、犯罪行為を禁止します。

初心者マークが付いている間は、まず街の雰囲気や基本ルールを理解することを優先してください。`,"warning","初心者,全住民"]
];
async function applyRuleContentV4(db){
 const marker=await db.prepare("SELECT value FROM site_settings WHERE key='rule_content_v4_applied'").first();
 if(marker?.value==='1')return;
 for(const r of RULE_CONTENT_V4){
  const [sl,ma,mi,title,content,layout,tags]=r;
  const [majorId,middleId]=await ensureSection(db,ma,mi);
  const old=await db.prepare("SELECT * FROM rules WHERE slug=? LIMIT 1").bind(sl).first();
  if(old){
   await hist(db,old,"はじめに・初心者向け更新前","ルール移行");
   await db.prepare(`UPDATE rules SET category=?,title=?,content=?,major_id=?,middle_id=?,layout_type=?,tags=?,is_published=1,retired_at=NULL,change_note='はじめに・初心者向け更新',edited_by='ルール移行',updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(ma,title,content,majorId,middleId,layout,tags,old.id).run();
  }else{
   const so=await next(db,"rules",middleId?"WHERE middle_id=?":"WHERE middle_id IS NULL",middleId?[middleId]:[]);
   await db.prepare(`INSERT INTO rules(slug,category,title,summary,content,display_type,is_published,sort_order,keywords,details,details_collapsed,change_note,new_until,major_id,middle_id,is_required,edited_by,layout_type,tags,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).bind(sl,ma,title,"",content,"normal",1,so,"","",1,"はじめに・初心者向け追加",null,majorId,middleId,0,"ルール移行",layout,tags).run();
  }
 }
 await db.prepare("INSERT INTO site_settings(key,value,updated_at,edited_by) VALUES('rule_content_v4_applied','1',CURRENT_TIMESTAMP,'ルール移行') ON CONFLICT(key) DO UPDATE SET value='1',updated_at=CURRENT_TIMESTAMP,edited_by='ルール移行'").run();
}

async function applyRuleContentV3(db){
 const marker=await db.prepare("SELECT value FROM site_settings WHERE key='rule_content_v3_applied'").first();
 if(marker?.value==='1')return;
 for(const r of RULE_CONTENT_V3){
  const [sl,ma,mi,title,content,layout,tags]=r;
  const [majorId,middleId]=await ensureSection(db,ma,mi);
  const old=await db.prepare("SELECT * FROM rules WHERE slug=? LIMIT 1").bind(sl).first();
  if(old){
   await hist(db,old,"正式ルール反映前","ルール移行");
   await db.prepare(`UPDATE rules SET category=?,title=?,content=?,major_id=?,middle_id=?,layout_type=?,tags=?,is_published=1,retired_at=NULL,change_note='正式ルール反映',edited_by='ルール移行',updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(ma,title,content,majorId,middleId,layout,tags,old.id).run();
  }else{
   const so=await next(db,"rules",middleId?"WHERE middle_id=?":"WHERE middle_id IS NULL",middleId?[middleId]:[]);
   await db.prepare(`INSERT INTO rules(slug,category,title,summary,content,display_type,is_published,sort_order,keywords,details,details_collapsed,change_note,new_until,major_id,middle_id,is_required,edited_by,layout_type,tags,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).bind(sl,ma,title,"",content,"normal",1,so,"","",1,"正式ルール追加",null,majorId,middleId,0,"ルール移行",layout,tags).run();
  }
 }
 // The old standalone white-citizen-license wording must not remain in seeded content.
 await db.prepare("UPDATE rules SET content=REPLACE(content,'白市民ライセンス','武器ライセンス') WHERE content LIKE '%白市民ライセンス%'").run();
 await db.prepare("INSERT INTO site_settings(key,value,updated_at,edited_by) VALUES('rule_content_v3_applied','1',CURRENT_TIMESTAMP,'ルール移行') ON CONFLICT(key) DO UPDATE SET value='1',updated_at=CURRENT_TIMESTAMP,edited_by='ルール移行'").run();
}

export default{async fetch(req,env){const u=new URL(req.url);
 if(u.pathname==="/api/admin/check"){if(!admin(req,env))return J({ok:false,message:"Unauthorized"},401);return J({ok:true,r2:!!env.IMAGES})}
 await schema(env.DB);
 try{await normalizeOfficialStructure(env.DB);await seedInitialRules(env.DB);await applyRuleContentV3(env.DB);await applyRuleContentV4(env.DB)}catch(err){console.error("rule migration skipped",err)}
 if(u.pathname==="/api/public"){const [rr,aa,ff,ii,ss,hh,nn]=await Promise.all([
  env.DB.prepare(`SELECT r.*,ma.title major_title,ma.description major_description,ma.is_required major_required,mi.title middle_title,mi.description middle_description,mi.is_required middle_required FROM rules r LEFT JOIN rule_major_titles ma ON ma.id=r.major_id LEFT JOIN rule_middle_titles mi ON mi.id=r.middle_id WHERE r.is_published=1 AND r.retired_at IS NULL ORDER BY COALESCE(ma.sort_order,99999),COALESCE(mi.sort_order,99999),r.sort_order,r.id`).all(),
  env.DB.prepare(`SELECT * FROM announcements WHERE is_published=1 ORDER BY is_important DESC,sort_order,id DESC`).all(),
  env.DB.prepare(`SELECT * FROM faqs WHERE is_published=1 ORDER BY sort_order,id`).all(),
  env.DB.prepare(`SELECT * FROM site_images WHERE is_published=1 ORDER BY slot,sort_order,id`).all(),settings(env.DB),
  env.DB.prepare(`SELECT rule_id,title,change_note,edited_by,saved_at FROM rule_history WHERE saved_at>=datetime('now','-60 days') ORDER BY saved_at DESC,id DESC LIMIT 80`).all(),
  env.DB.prepare(`SELECT r.id rule_id,r.title,r.created_at saved_at,r.edited_by,ma.title major_title,mi.title middle_title FROM rules r LEFT JOIN rule_major_titles ma ON ma.id=r.major_id LEFT JOIN rule_middle_titles mi ON mi.id=r.middle_id WHERE r.created_at>=datetime('now','-60 days') ORDER BY r.created_at DESC,r.id DESC LIMIT 50`).all()]);
  const updates=[...(nn.results||[]).map(x=>({...x,action:"追加",change_note:"新しいルールを追加しました。"})),...(hh.results||[]).map(x=>({...x,action:S(x.change_note).trim()==="廃止"?"廃止":"変更"}))].sort((a,b)=>S(b.saved_at).localeCompare(S(a.saved_at))).slice(0,5);
  return J({ok:true,rules:rr.results||[],announcements:aa.results||[],faqs:ff.results||[],images:ii.results||[],settings:ss,rule_updates:updates})
 }
 if(u.pathname.startsWith("/media/")){if(!env.IMAGES)return new Response("Not configured",{status:404});const key=decodeURIComponent(u.pathname.slice(7)),o=await env.IMAGES.get(key);if(!o)return new Response("Not found",{status:404});const h=new Headers();o.writeHttpMetadata(h);h.set("etag",o.httpEtag);h.set("cache-control","public,max-age=86400");return new Response(o.body,{headers:h})}
 if(!u.pathname.startsWith("/api/admin/"))return env.ASSETS.fetch(req);
 if(!admin(req,env))return J({ok:false,message:"Unauthorized"},401);const ed=editor(req);
 if(u.pathname==="/api/admin/dashboard"){const q=async(sql)=>+(await env.DB.prepare(sql).first())?.n||0;return J({ok:true,counts:{rules:await q("SELECT COUNT(*) n FROM rules WHERE retired_at IS NULL"),published:await q("SELECT COUNT(*) n FROM rules WHERE is_published=1 AND retired_at IS NULL"),announcements:await q("SELECT COUNT(*) n FROM announcements"),faqs:await q("SELECT COUNT(*) n FROM faqs"),images:await q("SELECT COUNT(*) n FROM site_images")},r2:!!env.IMAGES})}
 if(u.pathname==="/api/admin/majors"&&req.method==="GET"){const r=await env.DB.prepare("SELECT * FROM rule_major_titles ORDER BY sort_order,id").all();return J({ok:true,majors:r.results||[]})}
 if(u.pathname==="/api/admin/majors"&&req.method==="POST"){const b=await req.json(),t=S(b.title).trim();if(!t)return J({ok:false},400);const n=await next(env.DB,"rule_major_titles"),r=await env.DB.prepare("INSERT INTO rule_major_titles(title,description,is_required,sort_order,edited_by)VALUES(?,?,?,?,?)").bind(t,S(b.description),b.is_required?1:0,n,ed).run();return J({ok:true,id:r.meta.last_row_id})}
 let m=u.pathname.match(/^\/api\/admin\/majors\/(\d+)$/);if(m&&req.method==="PUT"){const b=await req.json();await env.DB.prepare("UPDATE rule_major_titles SET title=?,description=?,is_required=?,edited_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(S(b.title).trim(),S(b.description),b.is_required?1:0,ed,+m[1]).run();return J({ok:true})}
 m=u.pathname.match(/^\/api\/admin\/majors\/(\d+)\/move$/);if(m){const b=await req.json();await move(env.DB,"rule_major_titles",+m[1],b.direction);return J({ok:true})}
 if(u.pathname==="/api/admin/middles"&&req.method==="GET"){const r=await env.DB.prepare("SELECT mi.*,ma.title major_title FROM rule_middle_titles mi LEFT JOIN rule_major_titles ma ON ma.id=mi.major_id ORDER BY COALESCE(ma.sort_order,99999),mi.sort_order,mi.id").all();return J({ok:true,middles:r.results||[]})}
 if(u.pathname==="/api/admin/middles"&&req.method==="POST"){const b=await req.json(),mid=+b.major_id,t=S(b.title).trim();if(!mid||!t)return J({ok:false},400);const n=await next(env.DB,"rule_middle_titles","WHERE major_id=?",[mid]),r=await env.DB.prepare("INSERT INTO rule_middle_titles(major_id,title,description,is_required,sort_order,edited_by)VALUES(?,?,?,?,?,?)").bind(mid,t,S(b.description),b.is_required?1:0,n,ed).run();return J({ok:true,id:r.meta.last_row_id})}
 m=u.pathname.match(/^\/api\/admin\/middles\/(\d+)$/);if(m&&req.method==="PUT"){const b=await req.json();await env.DB.prepare("UPDATE rule_middle_titles SET major_id=?,title=?,description=?,is_required=?,edited_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(+b.major_id,S(b.title).trim(),S(b.description),b.is_required?1:0,ed,+m[1]).run();return J({ok:true})}
 m=u.pathname.match(/^\/api\/admin\/middles\/(\d+)\/move$/);if(m){const b=await req.json();await move(env.DB,"rule_middle_titles",+m[1],b.direction,"major_id");return J({ok:true})}
 if(u.pathname==="/api/admin/rules"&&req.method==="GET"){const r=await env.DB.prepare(`SELECT r.*,ma.title major_title,mi.title middle_title FROM rules r LEFT JOIN rule_major_titles ma ON ma.id=r.major_id LEFT JOIN rule_middle_titles mi ON mi.id=r.middle_id ORDER BY CASE WHEN r.retired_at IS NULL THEN 0 ELSE 1 END,COALESCE(ma.sort_order,99999),COALESCE(mi.sort_order,99999),r.sort_order,r.id`).all();return J({ok:true,rules:r.results||[]})}
 if(u.pathname==="/api/admin/rules"&&req.method==="POST"){const b=await req.json(),t=S(b.title).trim(),c=S(b.content).trim();if(!t||!c)return J({ok:false},400);const sl=await uniq(env.DB,b.slug,t),mi=b.middle_id?+b.middle_id:null,n=await next(env.DB,"rules",mi?"WHERE middle_id=?":"WHERE middle_id IS NULL",mi?[mi]:[]),r=await env.DB.prepare(`INSERT INTO rules(slug,category,title,summary,content,display_type,is_published,sort_order,keywords,details,details_collapsed,change_note,new_until,major_id,middle_id,is_required,edited_by,layout_type,tags,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).bind(sl,S(b.category),t,S(b.summary),c,S(b.display_type)||"normal",b.is_published?1:0,n,S(b.keywords),S(b.details),b.details_collapsed?1:0,S(b.change_note),null,b.major_id?+b.major_id:null,mi,b.is_required?1:0,ed,S(b.layout_type)||"text",S(b.tags)).run();return J({ok:true,id:r.meta.last_row_id})}
 m=u.pathname.match(/^\/api\/admin\/rules\/(\d+)$/);if(m&&req.method==="PUT"){const id=+m[1],old=await env.DB.prepare("SELECT * FROM rules WHERE id=?").bind(id).first(),b=await req.json();if(!old)return J({ok:false},404);await hist(env.DB,old,S(b.change_note),ed);const sl=await uniq(env.DB,b.slug||old.slug,b.title,id);await env.DB.prepare(`UPDATE rules SET slug=?,category=?,title=?,summary=?,content=?,display_type=?,is_published=?,keywords=?,details=?,details_collapsed=?,change_note=?,major_id=?,middle_id=?,is_required=?,edited_by=?,layout_type=?,tags=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(sl,S(b.category),S(b.title).trim(),S(b.summary),S(b.content).trim(),S(b.display_type)||"normal",b.is_published?1:0,S(b.keywords),S(b.details),b.details_collapsed?1:0,S(b.change_note),b.major_id?+b.major_id:null,b.middle_id?+b.middle_id:null,b.is_required?1:0,ed,S(b.layout_type)||"text",S(b.tags),id).run();return J({ok:true,id})}
 m=u.pathname.match(/^\/api\/admin\/rules\/(\d+)\/move$/);if(m){const b=await req.json();await move(env.DB,"rules",+m[1],b.direction,"middle_id");return J({ok:true})}
 m=u.pathname.match(/^\/api\/admin\/rules\/(\d+)\/retire$/);if(m){const id=+m[1],r=await env.DB.prepare("SELECT * FROM rules WHERE id=?").bind(id).first();await hist(env.DB,r,"廃止",ed);await env.DB.prepare("UPDATE rules SET is_published=0,retired_at=CURRENT_TIMESTAMP,edited_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(ed,id).run();return J({ok:true})}
 m=u.pathname.match(/^\/api\/admin\/rules\/(\d+)\/restore$/);if(m){await env.DB.prepare("UPDATE rules SET retired_at=NULL,is_published=0,edited_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(ed,+m[1]).run();return J({ok:true})}
 if(u.pathname==="/api/admin/rules/delete-selected"&&req.method==="DELETE"){const b=await req.json().catch(()=>({})),ids=[...new Set((Array.isArray(b.ids)?b.ids:[]).map(Number).filter(Number.isInteger).filter(x=>x>0))].slice(0,500);if(!ids.length)return J({ok:false,message:"削除するルールが選択されていません。"},400);const marks=ids.map(()=>"?").join(",");await env.DB.batch([env.DB.prepare(`DELETE FROM rule_history WHERE rule_id IN (${marks})`).bind(...ids),env.DB.prepare(`DELETE FROM rules WHERE id IN (${marks})`).bind(...ids)]);return J({ok:true,deleted:ids.length})}
 m=u.pathname.match(/^\/api\/admin\/rules\/(\d+)\/hard-delete$/);if(m&&req.method==="DELETE"){const id=+m[1];await env.DB.batch([env.DB.prepare("DELETE FROM rule_history WHERE rule_id=?").bind(id),env.DB.prepare("DELETE FROM rules WHERE id=?").bind(id)]);return J({ok:true})}
 m=u.pathname.match(/^\/api\/admin\/history\/(\d+)$/);if(m){const r=await env.DB.prepare("SELECT * FROM rule_history WHERE rule_id=? ORDER BY id DESC LIMIT 50").bind(+m[1]).all();return J({ok:true,history:r.results||[]})}
 if(u.pathname==="/api/admin/announcements"&&req.method==="GET"){const r=await env.DB.prepare("SELECT * FROM announcements ORDER BY sort_order,id DESC").all();return J({ok:true,items:r.results||[]})}
 if(u.pathname==="/api/admin/announcements"&&req.method==="POST"){const b=await req.json(),n=await next(env.DB,"announcements"),r=await env.DB.prepare("INSERT INTO announcements(title,body,tag,is_important,is_published,image_key,sort_order,published_at,edited_by)VALUES(?,?,?,?,?,?,?,?,?)").bind(S(b.title),S(b.body),S(b.tag)||"NEWS",b.is_important?1:0,b.is_published?1:0,S(b.image_key),n,b.is_published?new Date().toISOString():null,ed).run();return J({ok:true,id:r.meta.last_row_id})}
 m=u.pathname.match(/^\/api\/admin\/announcements\/(\d+)$/);if(m&&req.method==="PUT"){const b=await req.json();await env.DB.prepare("UPDATE announcements SET title=?,body=?,tag=?,is_important=?,is_published=?,image_key=?,edited_by=?,published_at=CASE WHEN ?=1 AND published_at IS NULL THEN CURRENT_TIMESTAMP ELSE published_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(S(b.title),S(b.body),S(b.tag)||"NEWS",b.is_important?1:0,b.is_published?1:0,S(b.image_key),ed,b.is_published?1:0,+m[1]).run();return J({ok:true})}
 if(u.pathname==="/api/admin/faqs"&&req.method==="GET"){const r=await env.DB.prepare("SELECT * FROM faqs ORDER BY sort_order,id").all();return J({ok:true,items:r.results||[]})}
 if(u.pathname==="/api/admin/faqs"&&req.method==="POST"){const b=await req.json(),n=await next(env.DB,"faqs"),r=await env.DB.prepare("INSERT INTO faqs(category,question,answer,is_published,sort_order,edited_by)VALUES(?,?,?,?,?,?)").bind(S(b.category),S(b.question),S(b.answer),b.is_published?1:0,n,ed).run();return J({ok:true,id:r.meta.last_row_id})}
 m=u.pathname.match(/^\/api\/admin\/faqs\/(\d+)$/);if(m&&req.method==="PUT"){const b=await req.json();await env.DB.prepare("UPDATE faqs SET category=?,question=?,answer=?,is_published=?,edited_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(S(b.category),S(b.question),S(b.answer),b.is_published?1:0,ed,+m[1]).run();return J({ok:true})}
 if(u.pathname==="/api/admin/settings"&&req.method==="GET")return J({ok:true,settings:await settings(env.DB)});
 if(u.pathname==="/api/admin/settings"&&req.method==="PUT"){const b=await req.json();for(const [k,v] of Object.entries(b))await env.DB.prepare("INSERT INTO site_settings(key,value,edited_by,updated_at)VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,edited_by=excluded.edited_by,updated_at=CURRENT_TIMESTAMP").bind(k,S(v),ed).run();return J({ok:true})}
 if(u.pathname==="/api/admin/images"&&req.method==="GET"){const r=await env.DB.prepare("SELECT * FROM site_images ORDER BY slot,sort_order,id").all();return J({ok:true,items:r.results||[],r2:!!env.IMAGES})}
 if(u.pathname==="/api/admin/images/upload"&&req.method==="POST"){if(!env.IMAGES)return J({ok:false,message:"R2 not configured"},503);const form=await req.formData(),file=form.get("file"),slot=S(form.get("slot"));if(!(file instanceof File)||!slot)return J({ok:false},400);if(file.size>5*1024*1024)return J({ok:false,message:"5MB以下にしてください"},413);const ex=ext(file.type);if(!ex)return J({ok:false,message:"JPG/PNG/WebP/GIFのみ"},415);const key=`${slot}/${Date.now()}-${crypto.randomUUID()}.${ex}`;await env.IMAGES.put(key,file.stream(),{httpMetadata:{contentType:file.type}});const n=await next(env.DB,"site_images","WHERE slot=?",[slot]),r=await env.DB.prepare("INSERT INTO site_images(slot,title,alt_text,object_key,is_published,sort_order,edited_by)VALUES(?,?,?,?,1,?,?)").bind(slot,S(form.get("title")),S(form.get("alt_text")),key,n,ed).run();return J({ok:true,id:r.meta.last_row_id,key})}
 m=u.pathname.match(/^\/api\/admin\/images\/(\d+)$/);if(m&&req.method==="DELETE"){const r=await env.DB.prepare("SELECT * FROM site_images WHERE id=?").bind(+m[1]).first();if(r){if(env.IMAGES)await env.IMAGES.delete(r.object_key);await env.DB.prepare("DELETE FROM site_images WHERE id=?").bind(+m[1]).run()}return J({ok:true})}
 return J({ok:false,message:"Not found"},404)
}}
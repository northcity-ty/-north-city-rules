North City 管理画面 v1

入れるファイル
- worker.js   → 既存の worker.js を上書き
- admin.html  → 新規追加
- admin.css   → 新規追加
- admin.js    → 新規追加

DBの追加操作は不要です。
初回に管理画面へ接続したとき、worker.js が必要な列・履歴テーブル・更新情報テーブルを自動で準備します。

重要：管理パスワードの設定が1回だけ必要です。
Cloudflare Worker に ADMIN_TOKEN という「Secret」を追加してください。
値は運営だけが知っている長めのパスワードにします。

設定後の管理画面:
https://northcity-rulebook.northcity652.workers.dev/admin.html

できること:
- 新規ルール
- 編集
- 公開 / 下書き
- 重要度
- 長い補足を折りたたむ
- 検索キーワード
- 並び順
- 固定URL用ID
- 変更履歴
- ルール廃止
- 変更時はNEW相当の期限を5日後に自動設定
- ルール変更を更新情報テーブルへ自動記録

※ NEWの画面表示・更新情報ページの画面表示は次の段階でサイト本体に接続します。

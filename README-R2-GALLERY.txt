North City R2 + ギャラリー拡大対応 v1

このZIPは、今回送ってもらった最新版ZIPを土台にしています。

変更点
・wrangler.jsonc をR2対応済みに変更
  binding: IMAGES
  bucket: northcity-images
・ギャラリーをPCでは3列にして、1枚を少し大きく表示
・ギャラリー画像をタップ/クリックすると大きく表示
・背景部分または×で閉じる
・PCはEscキーでも閉じられる
・スマホでも画面内いっぱいに近いサイズで表示
・画像読み込み失敗時はその画像枠を非表示

このままGitHubへ上書きしてデプロイしてください。

デプロイ成功時のBindingsに
env.DB
env.ASSETS
env.IMAGES
の3つが出ればR2接続成功です。

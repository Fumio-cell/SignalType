# SignalType

Text animation driven by an audio file. **音声ファイルで動く文字アニメーション。**

*Part of the Poetic Signal Toolkit.*

## [ English ]

SignalType draws text in 3D or flat, horizontal or vertical, and exports it as an MP4 or a PNG sequence. Everything runs in the browser tab: no upload, no account.

- **Text:** 3D (extruded, bevelled) or 2D. Horizontal or vertical writing with the Japanese typesetting rules (rotated long vowel marks and brackets, punctuation and small kana moved to the upper right, tate-chu-yoko, upright digits). Fonts: the bundled ones, or any TTF or OTF you drop in or import. A character the chosen font lacks is drawn with Zen Kaku Gothic New.
- **Audio:** load a file or try the bundled sample. Onsets above a threshold change the line (minimum stay and threshold are sliders). Loudness and beats move the ink bleed, the depth and the light, and the glitch; *Audio burst gain* scales all of it, and at 0 nothing depends on the audio.
- **Looks:** Weight (extrusion, bevel and light), Ink (blur then threshold on alpha), Interference (bands and a colour split, limited to the text).
- **Export:** 1080p or 4K, 30 fps. MP4 (H.264) or a ZIP of PNG frames with alpha. The MP4 has no audio track; it is an overlay and your track is already in your timeline. Frame time and random numbers come from the frame number, so exporting the same project again gives the same frames.

### Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run build:demo # the free preview build (exports are cut at 10 seconds)
npm run lint
```

MP4 export needs a browser with WebCodecs (Chrome or Edge). PNG export does not.

### Files

- `src/lib/vertical/` vertical writing: the rules table and the layout.
- `src/lib/fonts/`, `src/workers/fontWorker.ts` font parsing and glyph conversion, off the main thread.
- `src/lib/audio/` decoding, analysis, the line schedule, loudness and beat.
- `src/lib/look/` the three looks and their post-processing passes.
- `src/lib/export/` the deterministic export: frame clock, glyph atlas, MP4 and PNG writers.
- `src/styles/signal.css` the only place colours, type and spacing are defined.

Sample track (`public/sample/sample-track.m4a`): "Frequency Dreams" by Bomb Sun.

## [ 日本語 ]

SignalType は、文字を 3D または平面で、横書きまたは縦書きで描き、MP4 か PNG 連番として書き出すツールです。すべてブラウザのタブの中で動きます。アップロードもアカウントもありません。

- **文字:** 3D（押し出し・面取り）または 2D。横書きと縦書き。縦書きは日本語の組版規則に従います（長音・括弧の回転、句読点と小書き仮名の右上寄せ、縦中横、数字の正立）。書体は同梱のもの、またはドロップ・読み込みした任意の TTF / OTF。選んだ書体にない文字は Zen Kaku Gothic New で描きます。
- **音声:** ファイルを読み込むか、同梱の見本を再生します。閾値を超えたオンセットで行が切り替わります（最短の滞在時間と閾値はスライダー）。音量とビートは、滲み、奥行きと光、グリッチを動かします。*Audio burst gain* がその大きさを決め、0 のときは音声に何も依存しません。
- **ルック:** Weight（押し出し・面取り・光）、Ink（ぼかしてからアルファを閾値処理）、Interference（帯と色の分離。文字の範囲に限る）。
- **書き出し:** 1080p または 4K、30 fps。MP4（H.264）、またはアルファ付き PNG 連番の ZIP。MP4 に音声トラックはありません。オーバーレイとして使うもので、曲はあなたのタイムラインに既にあります。フレームの時刻と乱数はフレーム番号から決まるので、同じプロジェクトを書き出し直すと同じフレームが出ます。

### 実行

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ に本番ビルド
npm run build:demo # 無料プレビュー版（書き出しは 10 秒まで）
npm run lint
```

MP4 の書き出しには WebCodecs が使えるブラウザ（Chrome / Edge）が必要です。PNG の書き出しは不要です。

見本の曲（`public/sample/sample-track.m4a`）: "Frequency Dreams" by Bomb Sun。

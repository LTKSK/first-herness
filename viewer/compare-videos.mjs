import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const [beforeArg, afterArg, outputArg] = process.argv.slice(2);
if (!beforeArg || !afterArg || !outputArg)
  throw new Error(
    "Usage: node viewer/compare-videos.mjs <before videos.json> <after videos.json> <output directory>",
  );
async function input(arg) {
  const path = resolve(arg);
  const data = JSON.parse(await readFile(path, "utf8"));
  const videos = data.videos;
  if (
    typeof data.candidate !== "string" ||
    !data.candidate ||
    !Array.isArray(videos) ||
    videos.length !== 1 ||
    videos[0].kind !== "annotated" ||
    videos[0].targetId !== data.candidate ||
    typeof videos[0].path !== "string" ||
    !videos[0].path
  )
    throw new Error(`Invalid annotated video record: ${path}`);
  return { candidate: data.candidate, path: resolve(dirname(path), videos[0].path) };
}
const before = await input(beforeArg),
  after = await input(afterArg);
if (before.candidate === after.candidate)
  throw new Error("Before and after must be different candidates");
const output = resolve(outputArg);
await mkdir(output);
const filter =
  "[0:v]setpts=PTS-STARTPTS,scale=960:656:force_original_aspect_ratio=decrease,pad=960:656:(ow-iw)/2:(oh-ih)/2,setsar=1,drawbox=x=0:y=0:w=180:h=48:color=black@0.8:t=fill,drawtext=text=BEFORE:x=12:y=10:fontsize=24:fontcolor=white[left];[1:v]setpts=PTS-STARTPTS,scale=960:656:force_original_aspect_ratio=decrease,pad=960:656:(ow-iw)/2:(oh-ih)/2,setsar=1,drawbox=x=0:y=0:w=180:h=48:color=black@0.8:t=fill,drawtext=text=AFTER:x=12:y=10:fontsize=24:fontcolor=white[right];[left][right]hstack=inputs=2:shortest=0[out]";
const result = spawnSync(
  "ffmpeg",
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    before.path,
    "-i",
    after.path,
    "-filter_complex",
    filter,
    "-map",
    "[out]",
    "-an",
    "-c:v",
    "libvpx-vp9",
    "-crf",
    "32",
    "-b:v",
    "0",
    join(output, "comparison.webm"),
  ],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`FFmpeg failed: ${result.status}`);
await writeFile(
  join(output, "videos.json"),
  JSON.stringify(
    {
      candidate: after.candidate,
      videos: [
        {
          kind: "comparison",
          title: "変更前後の比較",
          path: "comparison.webm",
          baselineId: before.candidate,
          targetId: after.candidate,
          description: "左が変更前、右が変更後です。",
        },
      ],
    },
    null,
    2,
  ) + "\n",
);

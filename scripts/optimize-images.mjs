import sharp from "sharp";
const dir = "public/imagen";
const files = ["estadio", "balon", "cancha", "aficion", "trofeo"];
for (const f of files) {
  const info = await sharp(`${dir}/${f}.png`)
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72 })
    .toFile(`${dir}/${f}.webp`);
  console.log(`${f}.webp  ${(info.size / 1024).toFixed(0)} KB  ${info.width}x${info.height}`);
}

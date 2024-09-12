import * as cheerio from "cheerio";
import axios from "axios";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import diacritics from "diacritics";

// Đường dẫn thư mục chính lưu ảnh
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseImagesDir = path.join(__dirname, "images");

// Hàm để chuẩn hóa tên hero
function normalizeName(name) {
	// Chuyển tên thành chữ thường
	const lowerCaseName = name.toLowerCase();
	// Xóa dấu tiếng Việt và thay thế khoảng trắng bằng dấu gạch ngang
	const normalizedName = diacritics
		.remove(lowerCaseName)
		.replace(/\s+/g, "-") // Thay thế khoảng trắng bằng dấu gạch ngang
		.replace(/’/g, ""); // Loại bỏ dấu nháy đơn

	return normalizedName;
}

// Tạo thư mục chính lưu ảnh
fs.ensureDirSync(baseImagesDir);

// Lấy dữ liệu từ trang web
async function fetchHeroNames() {
	const url = "https://lienquan.garena.vn/hoc-vien/tuong-skin/";
	const { data } = await axios.get(url);
	const $ = cheerio.load(data);

	// Tìm tất cả tên hero
	const heroNames = [];
	$(".st-heroes__item--name").each((i, element) => {
		const name = $(element).text().trim();
		heroNames.push(normalizeName(name));
	});

	return heroNames;
}

// Tải ảnh về từ liên kết
async function downloadImage(url, filePath) {
	const response = await axios.get(url, { responseType: "stream" });
	response.data.pipe(fs.createWriteStream(filePath));
	return new Promise((resolve, reject) => {
		response.data.on("end", resolve);
		response.data.on("error", reject);
	});
}

// Chính hàm thực hiện tất cả các bước
async function main() {
	try {
		const heroNames = await fetchHeroNames();
		for (const name of heroNames) {
			const heroDir = path.join(baseImagesDir, name); // Tạo thư mục cho từng tướng
			fs.ensureDirSync(heroDir);

			const heroUrl = `https://lienquan.garena.vn/hoc-vien/tuong-skin/d/${name}/`;
			console.log(`Fetching ${heroUrl}`); // In URL để kiểm tra

			try {
				const { data } = await axios.get(heroUrl);
				const $ = cheerio.load(data);

				// Lấy tất cả các liên kết ảnh
				$("img").each(async (i, element) => {
					const imgSrc = $(element).attr("src");
					if (
						imgSrc &&
						imgSrc.includes(
							"https://dl.ops.kgvn.garenanow.com/hok/SkinLabel/"
						)
					) {
						const fileName = path.basename(imgSrc);
						const filePath = path.join(heroDir, fileName);
						console.log(`Downloading ${imgSrc} to ${filePath}`);
						await downloadImage(imgSrc, filePath);
					}
				});
			} catch (error) {
				console.error(`Error fetching ${heroUrl}:`, error.message);
			}
		}
	} catch (error) {
		console.error("Error in main:", error.message);
	}
}

main();

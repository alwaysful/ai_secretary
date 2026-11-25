-- 등록민간 대역 400001~599999로 넓힘 → 국제·어학 5xxxxx 번호를 6xxxxx로 옮김
UPDATE "Certificate" SET "no" = "no" + 100000 WHERE "no" > 500000 AND "no" < 600000;

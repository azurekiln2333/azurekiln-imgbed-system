-- ====================================================
-- 迁移脚本：添加图片描述字段
-- ====================================================

USE image_azurekiln_cn;

-- 添加 description 字段（如果已存在会报错，可忽略）
ALTER TABLE image_images
ADD COLUMN `description` varchar(500) DEFAULT NULL COMMENT '图片描述';

-- 验证
SELECT 'Images 表结构:' as '';
DESCRIBE image_images;

-- ====================================================
-- 迁移脚本：支持多备份挂载点
-- 执行前请备份数据库
-- ====================================================

USE image_azurekiln_cn;

-- 1. 创建备份记录表
CREATE TABLE IF NOT EXISTS `image_backups` (
  `id`            int(11) unsigned NOT NULL AUTO_INCREMENT,
  `image_key`     varchar(255)     NOT NULL COMMENT '关联图片 image_key',
  `mount_key`     varchar(32)      NOT NULL COMMENT '备份挂载点 mount_key',
  `upload_path`   varchar(512)     DEFAULT NULL COMMENT '备份路径',
  `status`        tinyint(1)       NOT NULL DEFAULT '0' COMMENT '0=待备份 1=备份中 2=成功 3=失败',
  `error_msg`     varchar(255)     DEFAULT NULL COMMENT '错误信息',
  `created_at`    timestamp        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at`  timestamp        NULL DEFAULT NULL COMMENT '备份完成时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_image_mount` (`image_key`, `mount_key`),
  KEY `idx_image_key` (`image_key`),
  KEY `idx_mount_key` (`mount_key`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='图片备份记录表';

-- 2. 迁移旧备份数据到新表
INSERT INTO image_backups (image_key, mount_key, upload_path, status, completed_at)
SELECT
    i.image_key,
    i.backup_mount_key,
    i.upload_path,
    i.backup_status,
    i.backup_at
FROM image_images i
WHERE i.backup_mount_key IS NOT NULL AND i.backup_status IN (2, 3);

-- 3. 删除旧字段
ALTER TABLE image_images
DROP COLUMN `backup_status`,
DROP COLUMN `backup_mount_key`,
DROP COLUMN `backup_at`;

-- ====================================================
-- 验证迁移结果
-- ====================================================
SELECT 'Images (sample):' as '';
SELECT image_key, mount_key, upload_path, is_private FROM image_images LIMIT 10;

SELECT 'Backups (sample):' as '';
SELECT b.image_key, b.mount_key, b.upload_path, b.status, b.completed_at
FROM image_backups b LIMIT 10;

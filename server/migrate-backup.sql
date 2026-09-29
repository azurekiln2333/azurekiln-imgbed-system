-- ====================================================
-- 迁移脚本：添加 backup_for 字段
-- 执行前请备份数据库
-- ====================================================

USE image_azurekiln_cn;

-- 1. 添加 backup_for 字段到挂载点表
ALTER TABLE image_mounts
ADD COLUMN `backup_for` varchar(32) DEFAULT NULL COMMENT '作为哪个挂载点的备份（mount_key）' AFTER `is_backup`;

-- 2. 添加索引
ALTER TABLE image_mounts
ADD KEY `idx_backup_for` (`backup_for`);

-- 3. 创建备份记录表（如果不存在）
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

-- ====================================================
-- 验证迁移结果
-- ====================================================
SELECT 'Mounts structure:' as '';
DESCRIBE image_mounts;

SELECT 'Backups table:' as '';
SELECT COUNT(*) as backup_count FROM image_backups;

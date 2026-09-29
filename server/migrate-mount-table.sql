-- ====================================================
-- 迁移脚本：分离 providers 和 mounts 表
-- 执行前请备份数据库
-- ====================================================

USE image_azurekiln_cn;

-- 1. 创建新的 providers 表（不含 mount_path, is_backup, is_public, owner_id）
CREATE TABLE IF NOT EXISTS `image_providers_new` (
  `id`            int(11) unsigned NOT NULL AUTO_INCREMENT,
  `provider_key`  varchar(32)      NOT NULL COMMENT '唯一标识，如 alist_1',
  `provider_name` varchar(50)      NOT NULL COMMENT '展示名称',
  `api_host`      varchar(255)     NOT NULL COMMENT '接口地址（含协议）',
  `api_token`     varchar(255)     DEFAULT NULL COMMENT 'API Token',
  `alist_username` varchar(100)    DEFAULT NULL COMMENT 'AList 登录用户名',
  `alist_password` varchar(255)    DEFAULT NULL COMMENT 'AList 登录密码',
  `status`        tinyint(1)       NOT NULL DEFAULT '1',
  `created_at`    timestamp        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    timestamp        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_provider_key` (`provider_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 迁移 providers 数据到新表（去除重复字段）
INSERT INTO image_providers_new (id, provider_key, provider_name, api_host, api_token, alist_username, alist_password, status, created_at, updated_at)
SELECT id, provider_key, provider_name, api_host, api_token, alist_username, alist_password, status, created_at, updated_at
FROM image_providers;

-- 3. 创建挂载点表
CREATE TABLE IF NOT EXISTS `image_mounts` (
  `id`            int(11) unsigned NOT NULL AUTO_INCREMENT,
  `provider_id`   int(11) unsigned NOT NULL COMMENT '关联存储节点 ID',
  `mount_key`     varchar(32)      NOT NULL COMMENT '唯一标识',
  `mount_name`    varchar(50)      NOT NULL COMMENT '展示名称',
  `mount_path`    varchar(255)     NOT NULL DEFAULT '/' COMMENT '挂载目录',
  `is_backup`     tinyint(1)       NOT NULL DEFAULT '0' COMMENT '1=备份存储 0=主存储',
  `is_public`     tinyint(1)       NOT NULL DEFAULT '0' COMMENT '1=公共存储 0=私有存储',
  `owner_id`      varchar(32)      DEFAULT NULL COMMENT '所属用户ID',
  `status`        tinyint(1)       NOT NULL DEFAULT '1',
  `created_at`    timestamp        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    timestamp        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mount_key` (`mount_key`),
  KEY `idx_provider_id` (`provider_id`),
  KEY `idx_owner_id` (`owner_id`),
  KEY `idx_is_public` (`is_public`),
  KEY `idx_is_backup` (`is_backup`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. 迁移旧 providers 数据到 mounts 表
-- 每个 provider 生成一个对应的 mount
INSERT INTO image_mounts (provider_id, mount_key, mount_name, mount_path, is_backup, is_public, owner_id, status, created_at, updated_at)
SELECT
    id,
    CONCAT('mount_', id) as mount_key,
    CONCAT(provider_name, IF(is_backup = 1, ' (备份)', '')) as mount_name,
    mount_path,
    is_backup,
    is_public,
    owner_id,
    status,
    created_at,
    updated_at
FROM image_providers;

-- 5. 更新 images 表：添加 mount_key 字段
ALTER TABLE image_images
ADD COLUMN `mount_key` varchar(32) DEFAULT NULL COMMENT '关联挂载点 mount_key' AFTER `image_key`,
ADD KEY `idx_mount_key` (`mount_key`);

-- 6. 迁移 images 表的 provider 字段到 mount_key
UPDATE image_images i
JOIN image_providers p ON i.provider = p.provider_key
SET i.mount_key = CONCAT('mount_', p.id);

-- 7. 更新 images 表：backup_provider 改为 backup_mount_key
ALTER TABLE image_images
ADD COLUMN `backup_mount_key` varchar(32) DEFAULT NULL COMMENT '备份挂载点 mount_key' AFTER `backup_status`;

UPDATE image_images i
JOIN image_providers p ON i.backup_provider = p.provider_key
SET i.backup_mount_key = CONCAT('mount_', p.id);

-- 8. 删除旧字段
ALTER TABLE image_images
DROP COLUMN `provider`,
DROP COLUMN `backup_provider`;

-- 8.5 添加 upload_path 和 is_private 字段
ALTER TABLE image_images
ADD COLUMN `upload_path` varchar(512) DEFAULT NULL COMMENT '实际上传路径' AFTER `mount_key`,
ADD COLUMN `is_private` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0=公共目录 1=私有目录' AFTER `upload_path`;

-- 迁移旧数据的 upload_path（假设旧数据都在挂载点根目录）
UPDATE image_images i
JOIN image_mounts m ON i.mount_key = m.mount_key
SET i.upload_path = CONCAT(m.mount_path, '/', i.image_key);

-- 9. 删除旧表，重命名新表
DROP TABLE image_providers;
RENAME TABLE image_providers_new TO image_providers;

-- 10. 添加外键约束
ALTER TABLE image_mounts
ADD CONSTRAINT `fk_mount_provider` FOREIGN KEY (`provider_id`) REFERENCES `image_providers` (`id`) ON DELETE CASCADE;

-- ====================================================
-- 验证迁移结果
-- ====================================================
SELECT 'Providers:' as '';
SELECT * FROM image_providers;

SELECT 'Mounts:' as '';
SELECT m.*, p.provider_key, p.api_host
FROM image_mounts m
JOIN image_providers p ON m.provider_id = p.id;

SELECT 'Images (sample):' as '';
SELECT image_key, mount_key, backup_mount_key, backup_status FROM image_images LIMIT 10;

-- 用户ID改为varchar + 存储配置归属功能 - 数据库升级脚本
-- 请在现有数据库上执行以下 SQL

-- 1. 给 users 表添加 role 字段，修改 id 为 varchar
-- 注意：需要先备份数据，然后重新创建表或手动迁移
-- 以下是新表结构，请根据实际情况调整

-- 创建临时表保存旧数据
CREATE TABLE IF NOT EXISTS `users_backup` AS SELECT * FROM `users`;

-- 删除旧表
DROP TABLE IF EXISTS `users`;

-- 创建新表
CREATE TABLE IF NOT EXISTS `users` (
  `id`            varchar(32)      NOT NULL COMMENT '用户ID，格式 uid_xxxx',
  `username`      varchar(50)      NOT NULL COMMENT '登录用户名',
  `password_hash` varchar(255)     NOT NULL COMMENT '密码哈希',
  `api_token`     varchar(64)      DEFAULT NULL COMMENT 'API 上传密钥',
  `role`          varchar(20)      NOT NULL DEFAULT 'user' COMMENT '角色: admin/user',
  `status`        tinyint(1)       NOT NULL DEFAULT '1' COMMENT '1=正常 0=封禁',
  `created_at`    timestamp        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    timestamp        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username`  (`username`),
  UNIQUE KEY `uk_api_token` (`api_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 2. 给 image_providers 表添加 is_public 和 owner_id 字段
ALTER TABLE `image_providers`
ADD COLUMN `is_public` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=公共存储 0=私有存储' AFTER `is_backup`,
ADD COLUMN `owner_id` varchar(32) DEFAULT NULL COMMENT '所属用户ID，公共存储为NULL' AFTER `is_public`,
ADD INDEX `idx_owner_id` (`owner_id`),
ADD INDEX `idx_is_public` (`is_public`);

-- 3. 修改 image_images 表的 uploader_id 为 varchar
ALTER TABLE `image_images`
MODIFY COLUMN `uploader_id` varchar(32) DEFAULT NULL COMMENT '上传者 ID';

-- 4. 插入默认管理员账号（密码: admin123）
-- 密码哈希使用 bcrypt 生成，cost=10
INSERT IGNORE INTO `users` (`id`, `username`, `password_hash`, `role`, `status`)
VALUES ('uid_admin', 'admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/n3.iW8jY9D6aV3xV9xKCe', 'admin', 1);

-- ====================================================
-- ImageHost 图床数据库初始化脚本
-- 执行前请先创建数据库: CREATE DATABASE imagehost CHARACTER SET utf8mb4;
-- ====================================================

USE image_azurekiln_cn;

-- 用户表
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

-- 存储节点配置表（AList 实例）
CREATE TABLE IF NOT EXISTS `image_providers` (
  `id`            int(11) unsigned NOT NULL AUTO_INCREMENT,
  `provider_key`  varchar(32)      NOT NULL COMMENT '唯一标识，如 alist_1',
  `provider_name` varchar(50)      NOT NULL COMMENT '展示名称',
  `api_host`      varchar(255)     NOT NULL COMMENT '接口地址（含协议），如 http://127.0.0.1:5244',
  `api_token`     varchar(255)     DEFAULT NULL COMMENT 'API Token（与用户名密码二选一）',
  `alist_username` varchar(100)    DEFAULT NULL COMMENT 'AList 登录用户名（与 Token 二选一）',
  `alist_password` varchar(255)    DEFAULT NULL COMMENT 'AList 登录密码（与 Token 二选一）',
  `status`        tinyint(1)       NOT NULL DEFAULT '1' COMMENT '1=启用 0=停用',
  `created_at`    timestamp        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    timestamp        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_provider_key` (`provider_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='存储节点配置表';

-- 挂载点表
CREATE TABLE IF NOT EXISTS `image_mounts` (
  `id`            int(11) unsigned NOT NULL AUTO_INCREMENT,
  `provider_id`   int(11) unsigned NOT NULL COMMENT '关联存储节点 ID',
  `mount_key`     varchar(32)      NOT NULL COMMENT '唯一标识',
  `mount_name`    varchar(50)      NOT NULL COMMENT '展示名称',
  `mount_path`    varchar(255)     NOT NULL DEFAULT '/' COMMENT '挂载目录',
  `is_backup`     tinyint(1)       NOT NULL DEFAULT '0' COMMENT '1=备份存储 0=主存储',
  `backup_for`    varchar(32)      DEFAULT NULL COMMENT '作为哪个挂载点的备份（mount_key）',
  `is_public`     tinyint(1)       NOT NULL DEFAULT '0' COMMENT '1=公共存储 0=私有存储',
  `owner_id`      varchar(32)      DEFAULT NULL COMMENT '所属用户ID，公共存储为NULL',
  `status`        tinyint(1)       NOT NULL DEFAULT '1' COMMENT '1=启用 0=停用',
  `created_at`    timestamp        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    timestamp        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mount_key` (`mount_key`),
  KEY `idx_provider_id` (`provider_id`),
  KEY `idx_owner_id` (`owner_id`),
  KEY `idx_is_public` (`is_public`),
  KEY `idx_is_backup` (`is_backup`),
  KEY `idx_backup_for` (`backup_for`),
  CONSTRAINT `fk_mount_provider` FOREIGN KEY (`provider_id`) REFERENCES `image_providers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='挂载点表';

-- 图片信息表
CREATE TABLE IF NOT EXISTS `image_images` (
  `id`               int(11) unsigned NOT NULL AUTO_INCREMENT,
  `image_key`        varchar(255)     NOT NULL COMMENT 'MD5+扩展名，如 abc123.jpg',
  `mount_key`        varchar(32)      NOT NULL COMMENT '关联挂载点 mount_key',
  `upload_path`      varchar(512)     DEFAULT NULL COMMENT '实际上传路径，如 /hi168/imgbed/public/abc.jpg',
  `is_private`       tinyint(1)       NOT NULL DEFAULT '0' COMMENT '0=公共目录 1=私有目录',
  `original_name`    varchar(255)     DEFAULT NULL COMMENT '原始文件名',
  `description`      varchar(500)     DEFAULT NULL COMMENT '图片描述',
  `file_size`        bigint(20)       DEFAULT NULL COMMENT '文件大小（字节）',
  `mime_type`        varchar(50)      DEFAULT NULL COMMENT 'MIME 类型',
  `uploader_id`      varchar(32)      DEFAULT NULL COMMENT '上传者 ID',
  `uploaded_at`      timestamp        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_accessed_at` timestamp        NULL DEFAULT NULL COMMENT '最后访问时间',
  `status`           tinyint(1)       NOT NULL DEFAULT '1' COMMENT '1=正常 0=已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_image_key` (`image_key`),
  KEY `idx_mount_key`   (`mount_key`),
  KEY `idx_uploaded_at` (`uploaded_at`),
  KEY `idx_uploader`    (`uploader_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='图片信息表';

-- 图片备份记录表
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

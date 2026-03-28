-- ====================================================
-- ImageHost 图床数据库初始化脚本
-- 执行前请先创建数据库: CREATE DATABASE imagehost CHARACTER SET utf8mb4;
-- ====================================================

USE image_azurekiln_cn;

-- 用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id`            int(11) unsigned NOT NULL AUTO_INCREMENT,
  `username`      varchar(50)      NOT NULL COMMENT '登录用户名',
  `password_hash` varchar(255)     NOT NULL COMMENT '密码哈希',
  `api_token`     varchar(64)      DEFAULT NULL COMMENT 'API 上传密钥',
  `status`        tinyint(1)       NOT NULL DEFAULT '1' COMMENT '1=正常 0=封禁',
  `created_at`    timestamp        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    timestamp        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username`  (`username`),
  UNIQUE KEY `uk_api_token` (`api_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 存储源配置表
CREATE TABLE IF NOT EXISTS `image_providers` (
  `id`            int(11) unsigned NOT NULL AUTO_INCREMENT,
  `provider_key`  varchar(32)      NOT NULL COMMENT '唯一标识，如 alist_1',
  `provider_name` varchar(50)      NOT NULL COMMENT '展示名称',
  `api_host`      varchar(255)     NOT NULL COMMENT '接口地址（含协议），如 http://127.0.0.1:5244',
  `api_token`     varchar(255)     DEFAULT NULL COMMENT 'API Token（与用户名密码二选一）',
  `alist_username` varchar(100)    DEFAULT NULL COMMENT 'AList 登录用户名（与 Token 二选一）',
  `alist_password` varchar(255)    DEFAULT NULL COMMENT 'AList 登录密码（与 Token 二选一）',
  `mount_path`    varchar(255)     DEFAULT '/' COMMENT '挂载目录',
  `status`        tinyint(1)       NOT NULL DEFAULT '1' COMMENT '1=启用 0=停用',
  `created_at`    timestamp        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    timestamp        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_provider_key` (`provider_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='存储源配置表';

-- 图片信息表
CREATE TABLE IF NOT EXISTS `image_images` (
  `id`               int(11) unsigned NOT NULL AUTO_INCREMENT,
  `image_key`        varchar(255)     NOT NULL COMMENT 'MD5+扩展名，如 abc123.jpg',
  `provider`         varchar(32)      NOT NULL COMMENT '关联 provider_key',
  `original_name`    varchar(255)     DEFAULT NULL COMMENT '原始文件名',
  `file_size`        bigint(20)       DEFAULT NULL COMMENT '文件大小（字节）',
  `mime_type`        varchar(50)      DEFAULT NULL COMMENT 'MIME 类型',
  `uploader_id`      int(11) unsigned DEFAULT NULL COMMENT '上传者 ID',
  `uploaded_at`      timestamp        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_accessed_at` timestamp        NULL DEFAULT NULL COMMENT '最后访问时间',
  `status`           tinyint(1)       NOT NULL DEFAULT '1' COMMENT '1=正常 0=已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_image_key` (`image_key`),
  KEY `idx_provider`    (`provider`),
  KEY `idx_uploaded_at` (`uploaded_at`),
  KEY `idx_uploader`    (`uploader_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='图片信息表';
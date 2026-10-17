-- 多 API 令牌功能 - 数据库升级脚本
-- 在已有数据库上执行以下 SQL 即可，无需改动其他表

USE image_azurekiln_cn;

-- 用户 API 令牌表：一个用户可创建多个上传令牌
-- 仅保存 sha256 哈希与展示用前缀，明文只在创建时返回一次
CREATE TABLE IF NOT EXISTS `user_api_tokens` (
  `id`            int(11) unsigned NOT NULL AUTO_INCREMENT,
  `user_id`       varchar(32)      NOT NULL COMMENT '所属用户ID',
  `name`          varchar(50)      NOT NULL COMMENT '令牌名称',
  `token_hash`    char(64)         NOT NULL COMMENT '令牌 sha256 哈希，明文不落库',
  `token_prefix`  varchar(16)      NOT NULL DEFAULT '' COMMENT '令牌前缀，仅用于展示',
  `status`        tinyint(1)       NOT NULL DEFAULT '1' COMMENT '1=启用 0=停用',
  `last_used_at`  timestamp        NULL DEFAULT NULL COMMENT '最后使用时间',
  `created_at`    timestamp        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_token_hash` (`token_hash`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户 API 令牌表';

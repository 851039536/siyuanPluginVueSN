# S3 备份

将思源笔记工作区备份到 S3 兼容存储（MinIO、Ceph、AWS S3 等），支持手动备份、备份列表管理和恢复。

## 功能

- **S3 配置**：支持自定义 endpoint、access key、secret key、bucket、region、path style、HTTPS 等
- **工作区备份**：逐文件扫描工作区 data 目录，直接上传到 S3
- **备份管理**：查看云端备份列表，支持下载、恢复和删除
- **连接测试**：保存配置前可测试 S3 连接是否正常

## 使用方式

1. 在设置中启用「S3 备份」功能
2. 打开 S3 备份面板，填写 S3 服务器配置
3. 点击「测试连接」验证配置正确
4. 点击「保存配置」
5. 选择工作区路径后，点击「立即备份」
6. 可在云端备份列表查看、下载或删除历史备份

## S3 兼容性

使用 AWS Signature V4 签名协议，兼容以下 S3 存储：
- MinIO
- Ceph (RADOS Gateway)
- AWS S3
- LocalStack
- DigitalOcean Spaces
- 任何 S3-compatible 存储

## 技术实现

- **签名算法**：AWS Signature V4，基于 Node.js crypto 模块，无外部 SDK 依赖
- **备份方式**：逐文件扫描→上传（上传超时 120s，跳过 temp/.recycle 目录）
- **存储**：PluginStorage + TypedStorage 持久化配置
- **UI**：Vue 3 Modal，Codex 风格

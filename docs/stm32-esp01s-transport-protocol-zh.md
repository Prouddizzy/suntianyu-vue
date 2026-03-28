# STM32 + ESP-01S 收发协议简版 (v1)

## 1. 适用范围
- 设备侧：STM32 + ESP-01S（AT 固件）
- 服务侧：Java TCP 网关
- 目标：实时状态上报 + 实时控制（启动/暂停/继续/停止）

本协议用于“设备 <-> 服务器”链路，不包含前端 HTTP 接口定义。

## 2. 传输层约定
- 通道：TCP 长连接（ESP-01S 透传）
- 编码：UTF-8
- 帧边界：单行 JSON + 换行符 `\n`
- 连接策略：断线自动重连
- 心跳周期：建议 5~10 秒（可复用状态上报）

## 3. 报文类型
- `status_report`：设备上报实时状态
- `control_cmd`：服务器下发控制命令
- `ack`：设备对命令应答
- `hello`：设备上线握手（可选）
- `ping/pong`：链路保活（可选）

## 4. 统一字段说明
公共字段（建议所有报文带上）：
- `type`：报文类型
- `deviceId`：设备唯一 ID（例如 `cabinet-001`）
- `ts`：时间戳（毫秒）
- `seq`：设备侧递增序号（防乱序、便于排错）

## 5. 上行：状态上报 status_report
### 5.1 示例
```json
{"type":"status_report","deviceId":"cabinet-001","seq":1024,"ts":1710403200000,"temperature":31.2,"humidity":58.4,"doorOpen":false,"machineRunning":true,"paused":false,"mode":"智能模式","heaterOn":true,"disinfectionOn":true,"fanOn":false,"remainingSeconds":0,"faultCode":0,"wifiRssi":-61,"fwVersion":"1.0.3"}
```

### 5.2 必传字段
- `temperature`：温度（单位：°C）
- `humidity`：湿度（单位：%RH）
- `doorOpen`：柜门状态
- `machineRunning`：是否运行
- `paused`：是否暂停
- `mode`：当前模式（加热模式/消毒模式/智能模式）
- `heaterOn`：加热执行器状态
- `disinfectionOn`：消毒灯状态
- `fanOn`：风扇状态
- `remainingSeconds`：剩余时间（智能模式可为 0）
- `faultCode`：故障码（无故障传 0）

### 5.3 建议上报频率
- 正常运行：1~2 秒一次
- 空闲状态：2~5 秒一次

## 6. 下行：控制命令 control_cmd
### 6.1 启动命令（start）
```json
{"type":"control_cmd","cmdId":"c202603140001","deviceId":"cabinet-001","action":"start","mode":"智能模式","duration":20,"thresholds":{"tempLow":24,"tempHigh":34,"humidityLow":45,"humidityHigh":65},"ts":1710403201000}
```

说明：
- `mode=加热模式/消毒模式` 时，`duration` 必须有效。
- `mode=智能模式` 时，`duration` 可忽略或置 0。

### 6.2 暂停/继续命令
```json
{"type":"control_cmd","cmdId":"c202603140002","deviceId":"cabinet-001","action":"pause","ts":1710403202000}
{"type":"control_cmd","cmdId":"c202603140003","deviceId":"cabinet-001","action":"resume","ts":1710403203000}
```

### 6.3 停止命令（stop）
```json
{"type":"control_cmd","cmdId":"c202603140004","deviceId":"cabinet-001","action":"stop","ts":1710403204000}
```

## 7. 上行：命令应答 ack
### 7.1 示例
```json
{"type":"ack","cmdId":"c202603140001","deviceId":"cabinet-001","ok":true,"code":0,"message":"ok","ts":1710403201500}
```

### 7.2 字段
- `cmdId`：对应下行命令 ID
- `ok`：是否执行成功
- `code`：结果码
- `message`：说明文本

推荐设备侧结果码：
- `0`：成功
- `1001`：参数非法
- `1002`：柜门打开，禁止启动
- `1004`：当前空闲，无法暂停/停止
- `1006`：暂停/继续状态非法
- `3001`：执行器控制失败
- `3002`：传感器异常

## 8. 设备侧状态机（建议）
状态集合：
- `IDLE`（空闲）
- `RUNNING`（运行）
- `PAUSED`（暂停）
- `FAULT`（故障）

状态迁移：
- `IDLE --start--> RUNNING`
- `RUNNING --pause--> PAUSED`
- `PAUSED --resume--> RUNNING`
- `RUNNING/PAUSED --stop--> IDLE`
- 任意状态检测到致命故障可进入 `FAULT`

实现建议：
- 所有命令先做参数校验，再执行，再回 ACK。
- ACK 先于下一次状态上报发送，减少前端等待感。

## 9. 粘包/拆包处理（STM32 必做）
因为 TCP 是字节流，必须在 STM32 做帧拼接：
- 接收缓冲区累计字节
- 遇到 `\n` 认为一帧结束
- 对完整 JSON 做解析
- 解析失败丢弃该帧并上报错误日志（可选）

伪流程：
1. UART 中断接收 ESP-01S 数据
2. 写入环形缓冲区
3. 主循环扫描 `\n`
4. 提取一行 JSON
5. 解析并执行命令
6. 回 ACK

## 10. 超时与重发建议
- 服务器下发命令后，等待 ACK 超时建议 3~5 秒。
- 超时后：
  - 服务端标记 `timeout`
  - 前端提示“命令已下发，设备未确认”
- 设备端不建议无脑重复执行同一 `cmdId`。

幂等建议：
- STM32 维护最近 N 条 `cmdId`（例如 20 条）
- 已执行过的 `cmdId` 再次收到时：不重复执行，仅回 ACK 成功

## 11. 安全与健壮性（最小集）
- 最小限度：加设备白名单（deviceId + token）
- 可选：报文增加 `sign`（HMAC）防篡改
- 门开保护逻辑应在设备侧也强制执行（不要只靠后端）

## 12. 与当前项目对接关系
你当前前端对应后端接口：
- 启动：`POST /api/v1/disinfector/tasks/start`
- 暂停/继续：`POST /api/v1/disinfector/tasks/pause`
- 停止：`POST /api/v1/disinfector/tasks/stop`
- 状态查询：`GET /api/v1/disinfector/runtime-status`

后端只需把设备上报状态映射为上述 runtime-status 响应结构即可。

## 13. 开发联调顺序（建议）
1. 先打通设备上线 + `status_report` 上报。
2. 再实现 `start/stop` 命令与 `ack`。
3. 再加 `pause/resume`。
4. 最后完善智能模式阈值联动与异常码。
## 14. 当前实现补充（2026-03）

### 14.1 紧凑命令字段

当前 Java -> STM32 下行命令使用紧凑字段：

```json
{"t":"cmd","c":"C001","id":"STM-001","a":"start","m":"智能模式","du":20,"tl":18,"th":34,"hl":45,"hh":65}
```

字段说明：

- `t`: 报文类型
- `c`: 命令 ID
- `id`: 设备 ID
- `a`: 动作
- `m`: 模式
- `du`: 时长（分钟）
- `tl/th/hl/hh`: 温湿度阈值

### 14.2 WiFi 下行命令

新增 WiFi 配置命令：

```json
{"t":"cmd","c":"C002","id":"STM-001","a":"wifi","ws":"LabWiFi","wp":"12345678"}
```

兼容解析：

- `a` 可为 `wifi`
- SSID 支持 `ws` 或 `ssid`
- 密码支持 `wp` 或 `password`

### 14.3 设备行为约定

- STM32 收到 `wifi` 命令后，只做参数校验、写入 Flash、返回 ACK
- 新 WiFi 配置不会在当前会话立即生效
- 设备仍保持当前网络连接，避免正在进行的控制链路被主动切断
- 下次上电或重启时，云控模块优先从 Flash 读取 WiFi 凭据并尝试联网

### 14.4 Flash 存储约定

- 当前固件使用 1 页 Flash 保存 WiFi 配置
- 存储内容至少包含：`magic`、`version`、`ssid`、`password`、`checksum`
- 若 Flash 中数据无效，则回退到 `APP_WIFI_SSID_DEFAULT` / `APP_WIFI_PASSWORD_DEFAULT`

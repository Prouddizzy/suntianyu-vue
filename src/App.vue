<template>
  <div id="app" class="page-bg">
    <main class="app-shell">
      <header class="top-bar">
        <div class="brand-block">
          <p class="brand-sub">SMART STERILIZER</p>
          <div class="brand-row">
            <h1>智能消毒柜</h1>
            <el-select
              v-model="selectedDeviceId"
              class="device-select"
              size="small"
              @change="handleDeviceChange"
            >
              <el-option
                v-for="device in deviceOptions"
                :key="device.value"
                :label="device.label"
                :value="device.value"
              />
            </el-select>
          </div>
        </div>
        <el-tag :type="headerStatusType" effect="dark" round>
          {{ headerStatusText }}
        </el-tag>
      </header>

      <div class="main-grid">
        <section>
          <div class="tile-grid">
            <el-card shadow="hover" class="tile tile-temp">
              <p class="tile-label">
                <el-icon class="tile-icon"><HotWater /></el-icon>
                温度
              </p>
              <div class="tile-value">
                {{ temperature.toFixed(1) }}<small>°C</small>
              </div>
              <el-progress
                :percentage="tempPercent"
                :show-text="false"
                :stroke-width="8"
              />
            </el-card>

            <el-card shadow="hover" class="tile tile-humidity">
              <p class="tile-label">
                <el-icon class="tile-icon"><MostlyCloudy /></el-icon>
                湿度
              </p>
              <div class="tile-value">
                {{ humidity.toFixed(1) }}<small>%RH</small>
              </div>
              <el-progress
                :percentage="humidityPercent"
                :show-text="false"
                :stroke-width="8"
              />
            </el-card>

            <el-card shadow="hover" class="tile">
              <p class="tile-label">
                <el-icon class="tile-icon"><Lock /></el-icon>
                柜门
              </p>
              <div class="door-line">
                <el-tag
                  :type="doorOpen ? 'warning' : 'success'"
                  effect="plain"
                  round
                >
                  {{ doorOpen ? "已打开" : "已关闭" }}
                </el-tag>
              </div>
              <p class="tile-tip">柜门打开时禁止启动。</p>
            </el-card>

            <el-card shadow="hover" class="tile">
              <p class="tile-label">
                <el-icon class="tile-icon"><Operation /></el-icon>
                运行状态
              </p>
              <div class="machine-state">
                <span class="state-dot" :class="machineStateDotClass"></span>
                <strong>{{ machineStateText }}</strong>
              </div>
              <p class="tile-tip">{{ actuatorText }}</p>
            </el-card>
          </div>

          <el-card shadow="never" class="control-card">
            <template #header>
              <div class="card-header-row">
                <span>远程模式控制</span>
                <el-button class="wifi-entry" plain @click="openWifiDialog">
                  <el-icon><Connection /></el-icon>
                  WiFi配置
                </el-button>
              </div>
            </template>

            <el-form label-position="top">
              <el-form-item label="选择模式">
                <el-radio-group v-model="selectedMode" class="mode-group">
                  <el-radio-button label="加热模式" />
                  <el-radio-button label="消毒模式" />
                  <el-radio-button label="智能模式" />
                </el-radio-group>
              </el-form-item>

              <el-form-item label="消毒时长（分钟）">
                <el-slider
                  v-model="duration"
                  :min="5"
                  :max="60"
                  :step="5"
                  :disabled="selectedMode === '智能模式'"
                  show-stops
                />
                <p class="tile-tip form-tip">
                  智能模式持续运行，直到你手动停止。
                </p>
              </el-form-item>

              <el-form-item label="温度警报阈值（°C）">
                <div class="threshold-row">
                  <el-input-number
                    v-model="tempLow"
                    :min="18"
                    :max="45"
                    :step="1"
                    controls-position="right"
                  />
                  <span class="threshold-sep">~</span>
                  <el-input-number
                    v-model="tempHigh"
                    :min="18"
                    :max="60"
                    :step="1"
                    controls-position="right"
                  />
                </div>
              </el-form-item>

              <el-form-item label="湿度警报阈值（%RH）">
                <div class="threshold-row">
                  <el-input-number
                    v-model="humidityLow"
                    :min="20"
                    :max="80"
                    :step="1"
                    controls-position="right"
                  />
                  <span class="threshold-sep">~</span>
                  <el-input-number
                    v-model="humidityHigh"
                    :min="30"
                    :max="95"
                    :step="1"
                    controls-position="right"
                  />
                </div>
              </el-form-item>
            </el-form>

            <div class="threshold-tools">
              <span class="tile-tip">
                阈值配置
                <strong>{{ thresholdChanged ? "未保存" : "已同步" }}</strong>
              </span>
              <el-button
                type="success"
                link
                :disabled="!backendOnline || !thresholdChanged"
                @click="saveThresholdSettings"
              >
                同步到消毒机
              </el-button>
            </div>

            <div class="quick-chips chips-control">
              <span class="chip">加热: {{ heaterOn ? "开启" : "关闭" }}</span>
              <span class="chip">消毒灯: {{ disinfectionOn ? "开启" : "关闭" }}</span>
              <span class="chip">风扇: {{ fanOn ? "开启" : "关闭" }}</span>
              <span class="chip" :class="{ 'chip-alert': hasThresholdAlert }">
                {{ hasThresholdAlert ? "阈值超限" : "阈值正常" }}
              </span>
              <span class="chip" :class="{ 'chip-backend-down': !backendOnline }">
                {{ backendOnline ? "设备在线" : "设备离线" }}
              </span>
            </div>

            <div class="action-row">
              <el-button
                type="primary"
                :disabled="!backendOnline || doorOpen || machineRunning"
                size="large"
                @click="startDisinfection"
              >
                启动消毒机
              </el-button>
              <el-button
                type="warning"
                plain
                :disabled="!backendOnline || !machineRunning"
                size="large"
                @click="togglePause"
              >
                {{ isPaused ? "继续工作" : "暂停工作" }}
              </el-button>
              <el-button
                type="danger"
                plain
                :disabled="!backendOnline || !machineRunning"
                size="large"
                @click="stopDisinfection"
              >
                停止任务
              </el-button>
            </div>
          </el-card>
        </section>

        <section class="overview-card">
          <div class="overview-title">设备总览</div>
          <p class="overview-text">{{ statusText }}</p>
          <div class="quick-chips">
            <span class="chip">设备: {{ selectedDeviceId }}</span>
            <span class="chip">模式: {{ selectedMode }}</span>
            <span class="chip">
              {{
                selectedMode === "智能模式"
                  ? "持续运行"
                  : `时长: ${duration} 分钟`
              }}
            </span>
            <span class="chip">柜门: {{ doorOpen ? "打开" : "关闭" }}</span>
            <span class="chip">温度阈值: {{ tempLow }}~{{ tempHigh }}°C</span>
            <span class="chip">湿度阈值: {{ humidityLow }}~{{ humidityHigh }}%RH</span>
          </div>
          <el-alert
            v-if="hasThresholdAlert"
            title="当前温湿度超出设定阈值，智能模式将自动调节加热、消毒和风扇。"
            type="warning"
            :closable="false"
            show-icon
            class="threshold-alert"
          />
        </section>
      </div>

      <el-dialog
        v-model="wifiDialogVisible"
        width="420px"
        title="设备 WiFi 配置"
        destroy-on-close
      >
        <el-form label-position="top">
          <el-form-item label="目标设备">
            <el-input :model-value="selectedDeviceId" disabled />
          </el-form-item>
          <el-form-item label="WiFi 名称（SSID）">
            <el-input
              v-model="wifiForm.ssid"
              maxlength="32"
              clearable
              placeholder="例如：STM32-Lab"
            />
          </el-form-item>
          <el-form-item label="WiFi 密码">
            <el-input
              v-model="wifiForm.password"
              maxlength="64"
              show-password
              placeholder="请输入 8 位及以上密码"
            />
          </el-form-item>
          <p class="tile-tip wifi-tip">
            WiFi 配置会下发到设备并保存到 Flash，当前不会立刻重连 WiFi，重启设备后生效。
          </p>
        </el-form>
        <template #footer>
          <div class="dialog-footer">
            <el-button @click="wifiDialogVisible = false">取消</el-button>
            <el-button type="primary" :loading="wifiSaving" @click="saveWifiConfig">
              保存配置
            </el-button>
          </div>
        </template>
      </el-dialog>
    </main>
  </div>
</template>

<script>
import { ElMessage } from "element-plus";
import {
  Connection,
  HotWater,
  Lock,
  MostlyCloudy,
  Operation,
} from "@element-plus/icons-vue";
import { apiMeta, disinfectorApi } from "./api/disinfectorApi";

export default {
  name: "App",
  components: {
    Connection,
    HotWater,
    MostlyCloudy,
    Lock,
    Operation,
  },
  data() {
    return {
      selectedDeviceId: "STM-001",
      deviceOptions: [
        { label: "STM-001", value: "STM-001" },
      ],
      temperature: 27.3,
      humidity: 53.6,
      doorOpen: false,
      machineRunning: false,
      runtimeMode: "智能模式",
      runtimeDuration: 20,
      selectedMode: "智能模式",
      duration: 20,
      tempLow: 18,
      tempHigh: 34,
      humidityLow: 45,
      humidityHigh: 65,
      heaterOn: false,
      disinfectionOn: false,
      fanOn: false,
      timerHandle: null,
      sensorHandle: null,
      statusPollingHandle: null,
      statusPollingRequestPending: false,
      pollingBoostUntil: 0,
      remainingSeconds: 0,
      backendOnline: true,
      apiModeText: apiMeta.useMockApi ? "模拟接口" : "服务端",
      isPaused: false,
      wifiDialogVisible: false,
      wifiSaving: false,
      wifiForm: {
        ssid: "",
        password: "",
      },
      lastSavedThresholds: {
        tempLow: 18,
        tempHigh: 34,
        humidityLow: 45,
        humidityHigh: 65,
      },
    };
  },
  computed: {
    isDeviceOffline() {
      return !this.backendOnline;
    },
    headerStatusType() {
      if (this.isDeviceOffline) {
        return "info";
      }

      if (this.machineRunning) {
        return this.isPaused ? "warning" : "danger";
      }

      return "success";
    },
    headerStatusText() {
      if (this.isDeviceOffline) {
        return "设备离线";
      }

      if (this.machineRunning) {
        return this.isPaused ? "暂停中" : "工作中";
      }

      return "空闲中";
    },
    tempPercent() {
      return Math.min(
        100,
        Math.max(0, Math.round((this.temperature / 50) * 100)),
      );
    },
    humidityPercent() {
      return Math.min(100, Math.max(0, Math.round(this.humidity)));
    },
    hasThresholdAlert() {
      return (
        this.temperature < this.tempLow
        || this.temperature > this.tempHigh
        || this.humidity < this.humidityLow
        || this.humidity > this.humidityHigh
      );
    },
    thresholdChanged() {
      return (
        this.tempLow !== this.lastSavedThresholds.tempLow
        || this.tempHigh !== this.lastSavedThresholds.tempHigh
        || this.humidityLow !== this.lastSavedThresholds.humidityLow
        || this.humidityHigh !== this.lastSavedThresholds.humidityHigh
      );
    },
    activeMode() {
      return this.runtimeMode || this.selectedMode;
    },
    machineStateText() {
      if (this.isDeviceOffline) {
        return "设备离线";
      }

      if (!this.machineRunning) {
        return "设备空闲中";
      }

      if (this.isPaused) {
        return "任务已暂停";
      }

      if (this.activeMode === "加热模式") {
        return "加热模式运行中";
      }

      if (this.activeMode === "消毒模式") {
        return "消毒模式运行中";
      }

      return "智能模式运行中";
    },
    machineStateDotClass() {
      return {
        active: this.backendOnline && this.machineRunning,
        offline: this.isDeviceOffline,
      };
    },
    actuatorText() {
      if (this.isDeviceOffline) {
        return "设备离线，等待重新连接后再同步设备状态。";
      }

      if (!this.machineRunning) {
        return "支持远程切换模式与一键启停。";
      }

      if (this.isPaused) {
        return "任务已暂停，执行器已临时关闭。";
      }

      return `加热:${this.heaterOn ? "开启" : "关闭"} / 消毒灯:${this.disinfectionOn ? "开启" : "关闭"} / 风扇:${this.fanOn ? "开启" : "关闭"}`;
    },
    statusText() {
      if (this.isDeviceOffline) {
        return "设备已离线，页面会保留上一次配置，待设备重新连接后自动更新最新运行状态。";
      }

      if (this.doorOpen) {
        return "柜门已打开，无法启动消毒任务。";
      }

      if (this.machineRunning) {
        if (this.isPaused) {
          return `任务暂停中，可继续或停止（${this.apiModeText}）。`;
        }

        if (this.activeMode === "智能模式") {
          return `智能模式运行中：实时检测温湿度，自动控制加热与风扇（${this.apiModeText}）。`;
        }

        return `${this.activeMode}运行中，预计 ${Math.ceil(this.remainingSeconds / 60)} 分钟完成。`;
      }

      return `设备空闲，可远程下发任务（${this.apiModeText}）。`;
    },
  },
  watch: {
    tempLow(value) {
      if (value >= this.tempHigh) {
        this.tempHigh = value + 1;
      }
    },
    tempHigh(value) {
      if (value <= this.tempLow) {
        this.tempLow = value - 1;
      }
    },
    humidityLow(value) {
      if (value >= this.humidityHigh) {
        this.humidityHigh = value + 1;
      }
    },
    humidityHigh(value) {
      if (value <= this.humidityLow) {
        this.humidityLow = value - 1;
      }
    },
  },
  mounted() {
    this.loadWifiDraft();
    if (apiMeta.useMockApi) {
      this.sensorHandle = window.setInterval(this.updateSensorData, 2000);
    }
    this.bootstrapBackendReservation({ syncControls: true });
  },
  beforeUnmount() {
    this.cleanupRealtimeResources();
  },
  methods: {
    resolveErrorMessage(error) {
      return error?.message || "服务端未响应";
    },
    getWifiStorageKey(deviceId = this.selectedDeviceId) {
      return `stm32-smart-disinfector:wifi:${deviceId}`;
    },
    loadWifiDraft(deviceId = this.selectedDeviceId) {
      const fallback = { ssid: "", password: "" };

      if (typeof window === "undefined") {
        this.wifiForm = { ...fallback };
        return;
      }

      try {
        const savedValue = window.localStorage.getItem(this.getWifiStorageKey(deviceId));
        this.wifiForm = savedValue
          ? { ...fallback, ...JSON.parse(savedValue) }
          : { ...fallback };
      } catch (error) {
        this.wifiForm = { ...fallback };
      }
    },
    persistWifiDraft(deviceId = this.selectedDeviceId) {
      if (typeof window === "undefined") {
        return;
      }

      window.localStorage.setItem(
        this.getWifiStorageKey(deviceId),
        JSON.stringify(this.wifiForm),
      );
    },
    openWifiDialog() {
      this.loadWifiDraft(this.selectedDeviceId);
      this.wifiDialogVisible = true;
    },
    cleanupRealtimeResources() {
      if (this.timerHandle) {
        window.clearInterval(this.timerHandle);
        this.timerHandle = null;
      }
      if (this.sensorHandle) {
        window.clearInterval(this.sensorHandle);
        this.sensorHandle = null;
      }
      if (this.statusPollingHandle) {
        window.clearTimeout(this.statusPollingHandle);
        this.statusPollingHandle = null;
      }
      this.statusPollingRequestPending = false;
      this.pollingBoostUntil = 0;
    },
    async handleDeviceChange(deviceId) {
      this.selectedDeviceId = deviceId;
      this.loadWifiDraft(deviceId);
      await this.bootstrapBackendReservation({ syncControls: true });
      ElMessage.success(`已切换到设备 ${deviceId}`);
    },
    async bootstrapBackendReservation(options = {}) {
      await this.syncConfigFromBackend(options);
      await this.syncStatusFromBackend(options);
      this.restartStatusPolling();
    },
    getStatusPollingInterval() {
      if (Date.now() < this.pollingBoostUntil) {
        return 500;
      }

      if (this.machineRunning) {
        return 1000;
      }

      return 2000;
    },
    boostStatusPolling(durationMs = 5000) {
      this.pollingBoostUntil = Math.max(
        this.pollingBoostUntil,
        Date.now() + durationMs,
      );
      this.restartStatusPolling(300);
    },
    restartStatusPolling(delayMs = null) {
      if (this.statusPollingHandle) {
        window.clearTimeout(this.statusPollingHandle);
        this.statusPollingHandle = null;
      }

      const nextDelay = typeof delayMs === "number"
        ? delayMs
        : this.getStatusPollingInterval();

      this.statusPollingHandle = window.setTimeout(async () => {
        this.statusPollingHandle = null;
        await this.syncStatusFromBackend();
        this.restartStatusPolling();
      }, Math.max(0, nextDelay));
    },
    applyBackendState(state, options = {}) {
      if (!state) {
        return;
      }

      const shouldSyncControls = options.syncControls === true;

      this.machineRunning = state.machineRunning ?? this.machineRunning;
      this.runtimeMode = state.selectedMode || this.runtimeMode;
      this.runtimeDuration = state.duration ?? this.runtimeDuration;
      this.temperature = state.temperature ?? this.temperature;
      this.humidity = state.humidity ?? this.humidity;
      this.doorOpen = state.doorOpen ?? this.doorOpen;
      this.heaterOn = state.heaterOn ?? this.heaterOn;
      this.disinfectionOn = state.disinfectionOn ?? this.disinfectionOn;
      this.fanOn = state.fanOn ?? this.fanOn;
      this.isPaused = state.paused ?? this.isPaused;
      this.remainingSeconds = state.remainingSeconds ?? this.remainingSeconds;

      if (shouldSyncControls) {
        this.selectedMode = state.selectedMode || this.selectedMode;
        this.duration = state.duration ?? this.duration;
        this.tempLow = state.tempLow ?? this.tempLow;
        this.tempHigh = state.tempHigh ?? this.tempHigh;
        this.humidityLow = state.humidityLow ?? this.humidityLow;
        this.humidityHigh = state.humidityHigh ?? this.humidityHigh;
      }
    },
    async syncConfigFromBackend(options = {}) {
      const requestDeviceId = this.selectedDeviceId;

      try {
        const response = await disinfectorApi.getConfig(requestDeviceId);
        if (requestDeviceId !== this.selectedDeviceId) {
          return;
        }

        this.backendOnline = true;
        this.applyBackendState(response.data, options);
        if (options.syncControls) {
          this.lastSavedThresholds = {
            tempLow: this.tempLow,
            tempHigh: this.tempHigh,
            humidityLow: this.humidityLow,
            humidityHigh: this.humidityHigh,
          };
        }
      } catch (error) {
        this.backendOnline = false;
        if (!apiMeta.useMockApi) {
          ElMessage.warning(this.resolveErrorMessage(error));
        }
      }
    },
    async syncStatusFromBackend(options = {}) {
      if (this.statusPollingRequestPending) {
        return;
      }

      const requestDeviceId = this.selectedDeviceId;
      this.statusPollingRequestPending = true;
      try {
        const response = await disinfectorApi.getRuntimeStatus(requestDeviceId);
        if (requestDeviceId !== this.selectedDeviceId) {
          return;
        }

        this.backendOnline = true;
        this.applyBackendState(response.data, options);
      } catch (error) {
        this.backendOnline = false;
      } finally {
        this.statusPollingRequestPending = false;
      }
    },
    async saveThresholdSettings() {
      if (!this.backendOnline) {
        ElMessage.warning("设备离线，暂时无法同步阈值。");
        return;
      }

      try {
        const response = await disinfectorApi.updateThresholds(this.selectedDeviceId, {
          tempLow: this.tempLow,
          tempHigh: this.tempHigh,
          humidityLow: this.humidityLow,
          humidityHigh: this.humidityHigh,
        });
        if (response.code && response.code !== 0) {
          ElMessage.warning(response.message || "阈值保存失败");
          return;
        }
        this.backendOnline = true;
        this.applyBackendState(response.data, { syncControls: true });
        this.lastSavedThresholds = {
          tempLow: this.tempLow,
          tempHigh: this.tempHigh,
          humidityLow: this.humidityLow,
          humidityHigh: this.humidityHigh,
        };
        this.boostStatusPolling(3000);
        ElMessage.success("阈值已保存。");
      } catch (error) {
        this.backendOnline = false;
        ElMessage.warning(this.resolveErrorMessage(error));
      }
    },
    async saveWifiConfig() {
      const ssid = this.wifiForm.ssid.trim();
      const password = this.wifiForm.password.trim();

      if (!ssid) {
        ElMessage.warning("请输入 WiFi 名称。");
        return;
      }

      if (password.length < 8) {
        ElMessage.warning("WiFi 密码至少需要 8 位。");
        return;
      }

      this.wifiSaving = true;
      this.wifiForm = { ssid, password };
      this.persistWifiDraft(this.selectedDeviceId);

      try {
        const response = await disinfectorApi.updateWifiConfig(this.selectedDeviceId, {
          ssid,
          password,
        });

        if (response.code && response.code !== 0) {
          ElMessage.warning(response.message || "WiFi 配置保存失败");
          return;
        }

        this.wifiDialogVisible = false;
        ElMessage.success(`已保存 ${this.selectedDeviceId} 的 WiFi 配置，重启设备后生效。`);
      } catch (error) {
        ElMessage.warning(this.resolveErrorMessage(error));
      } finally {
        this.wifiSaving = false;
      }
    },
    applySmartControl() {
      const tempTooHigh = this.temperature > this.tempHigh;
      const tempTooLow = this.temperature < this.tempLow;
      const humidityTooHigh = this.humidity > this.humidityHigh;
      const humidityTooLow = this.humidity < this.humidityLow;

      this.disinfectionOn = true;

      if (tempTooHigh) {
        this.heaterOn = false;
      } else if (tempTooLow) {
        this.heaterOn = true;
      }

      if (humidityTooHigh || tempTooHigh) {
        this.fanOn = true;
      }

      if (!humidityTooHigh && !tempTooHigh) {
        this.fanOn = false;
      }

      if (humidityTooLow && !tempTooHigh) {
        this.fanOn = false;
      }
    },
    updateSensorData() {
      if (this.machineRunning && !this.isPaused) {
        if (this.heaterOn) {
          this.temperature += 0.2 + Math.random() * 0.3;
        } else {
          this.temperature -= 0.08 + Math.random() * 0.15;
        }

        if (this.fanOn) {
          this.humidity -= 0.25 + Math.random() * 0.35;
          this.temperature -= 0.05;
        } else {
          this.humidity += (Math.random() - 0.45) * 0.3;
        }

        if (this.runtimeMode === "智能模式") {
          this.applySmartControl();
        }
      } else if (!this.machineRunning) {
        this.temperature += (27 - this.temperature) * 0.08;
        this.humidity += (55 - this.humidity) * 0.08;
      }

      this.temperature = Number(Math.min(60, Math.max(10, this.temperature)).toFixed(1));
      this.humidity = Number(Math.min(95, Math.max(20, this.humidity)).toFixed(1));
    },
    startManualTimer() {
      if (this.remainingSeconds <= 0) {
        this.remainingSeconds = this.duration * 60;
      }
      if (this.timerHandle) {
        window.clearInterval(this.timerHandle);
      }
      this.timerHandle = window.setInterval(() => {
        if (this.isPaused) {
          return;
        }
        this.remainingSeconds -= 1;
        if (this.remainingSeconds <= 0) {
          this.stopDisinfection(true);
        }
      }, 1000);
    },
    async startDisinfection() {
      if (!this.backendOnline) {
        ElMessage.warning("设备离线，无法启动任务。");
        return;
      }

      if (this.doorOpen) {
        ElMessage.warning("柜门打开状态下禁止启动，请先关闭柜门。");
        return;
      }

      try {
        const response = await disinfectorApi.startTask(this.selectedDeviceId, {
          mode: this.selectedMode,
          duration: this.duration,
          thresholds: {
            tempLow: this.tempLow,
            tempHigh: this.tempHigh,
            humidityLow: this.humidityLow,
            humidityHigh: this.humidityHigh,
          },
        });
        if (response.code && response.code !== 0) {
          this.backendOnline = true;
          ElMessage.warning(response.message || "启动失败");
          return;
        }
        this.backendOnline = true;
        this.applyBackendState(response.data);
        this.boostStatusPolling();
      } catch (error) {
        this.backendOnline = false;
        ElMessage.warning(this.resolveErrorMessage(error));
        return;
      }

      if (apiMeta.useMockApi && this.selectedMode !== "智能模式") {
        this.startManualTimer();
      }

      if (this.selectedMode === "智能模式") {
        ElMessage.success("已启动智能模式，系统将按阈值自动调节。");
        return;
      }

      ElMessage.success(`已启动${this.selectedMode}，时长 ${this.duration} 分钟。`);
    },
    async togglePause() {
      if (!this.backendOnline) {
        ElMessage.warning("设备离线，无法执行暂停或继续。");
        return;
      }

      if (!this.machineRunning) {
        return;
      }

      const action = this.isPaused ? "resume" : "pause";

      try {
        const response = await disinfectorApi.pauseTask(this.selectedDeviceId, { action });
        if (response.code && response.code !== 0) {
          ElMessage.warning(response.message || "暂停/继续失败");
          return;
        }
        this.backendOnline = true;
        this.applyBackendState(response.data);
        this.boostStatusPolling();
      } catch (error) {
        this.backendOnline = false;
        ElMessage.warning(this.resolveErrorMessage(error));
        return;
      }

      if (this.isPaused) {
        ElMessage.info("任务已暂停。");
        return;
      }

      ElMessage.success("任务已继续执行。");
    },
    async stopDisinfection(byTimer = false) {
      if (!this.backendOnline) {
        ElMessage.warning("设备离线，无法停止任务。");
        return;
      }

      try {
        const response = await disinfectorApi.stopTask(this.selectedDeviceId);
        if (response.code && response.code !== 0) {
          this.backendOnline = true;
          ElMessage.warning(response.message || "停止失败");
          return;
        }
        this.backendOnline = true;
        this.applyBackendState(response.data);
        this.boostStatusPolling();
      } catch (error) {
        this.backendOnline = false;
        ElMessage.warning(this.resolveErrorMessage(error));
        return;
      }

      if (this.timerHandle) {
        window.clearInterval(this.timerHandle);
        this.timerHandle = null;
      }
      ElMessage.info(
        byTimer
          ? "定时结束，设备已自动停止。"
          : "消毒任务已停止，设备回到空闲状态。",
      );
    },
  },
};
</script>

<style>
:root {
  --bg-1: #f3f6f2;
  --bg-2: #dbe7dd;
  --paper: #fbfdfb;
  --card: #ffffff;
  --ink: #153223;
  --sub: #5b7466;
  --line: #d9e5de;
  --brand: #2d8b57;
}

* {
  box-sizing: border-box;
}

html,
body,
#app {
  margin: 0;
  min-height: 100%;
}

body {
  font-family: "DIN Alternate", "PingFang SC", "Microsoft YaHei", sans-serif;
  color: var(--ink);
}

.page-bg {
  position: relative;
  min-height: 100vh;
  padding: 0;
  background: #ffffff;
  overflow: hidden;
}

.app-shell {
  position: relative;
  z-index: 1;
  width: 100%;
  min-height: 100vh;
  max-width: none;
  margin: 0 auto;
  border-radius: 0;
  background: #ffffff;
  border: 0;
  box-shadow: none;
  padding: 14px;
}

.top-bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.brand-block {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.brand-sub {
  margin: 0;
  font-size: 11px;
  letter-spacing: 1.2px;
  color: #7b9387;
  line-height: 1;
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-height: 34px;
}

.top-bar h1 {
  margin: 0;
  font-size: 1.42rem;
  line-height: 1.08;
}

.device-select {
  width: 124px;
}

.device-select .el-input__wrapper,
.device-select .el-select__wrapper {
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: #f4faf6;
  box-shadow: 0 0 0 1px #d8e7dd inset;
  color: var(--ink);
  font-size: 14px;
}

.device-select .el-input__inner,
.device-select .el-select__selected-item,
.device-select .el-select__placeholder {
  color: var(--ink);
  font-size: 14px;
  font-weight: 500;
}

.overview-card {
  border: 1px solid var(--line);
  background: linear-gradient(120deg, #f6fbf8, #ffffff);
  border-radius: 18px;
  padding: 14px;
  margin-bottom: 12px;
}

.overview-title {
  font-weight: 700;
  margin-bottom: 6px;
}

.overview-text {
  margin: 0;
  color: var(--sub);
  font-size: 13px;
  line-height: 1.55;
}

.quick-chips {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  font-size: 12px;
  padding: 4px 9px;
  border-radius: 999px;
  background: #edf5ef;
  color: #436454;
}

.chip-alert {
  background: #fff1f0;
  color: #cf4434;
}

.chip-backend-down {
  background: #fff4e6;
  color: #c27c2f;
}

.main-grid {
  display: block;
}

.tile-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.tile {
  border-radius: 14px;
  border: 1px solid var(--line);
  min-height: 138px;
}

.tile-temp {
  background: linear-gradient(160deg, #ffffff, #eef8f1);
}

.tile-humidity {
  background: linear-gradient(160deg, #ffffff, #eef4fb);
}

.tile-label {
  margin: 0;
  font-size: 12px;
  color: var(--sub);
  display: flex;
  align-items: center;
  gap: 6px;
}

.tile-icon {
  color: var(--brand);
  font-size: 15px;
}

.tile-value {
  margin: 6px 0 10px;
  font-size: 1.52rem;
  font-weight: 700;
}

.tile-value small {
  font-size: 0.82rem;
  margin-left: 2px;
  color: #6f8679;
}

.door-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 0 10px;
}

.tile-tip {
  margin: 0;
  font-size: 12px;
  color: #789184;
}

.machine-state {
  margin: 12px 0 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.state-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #2d8b57;
}

.state-dot.active {
  background: #e44b3a;
  box-shadow: 0 0 0 6px rgba(228, 75, 58, 0.15);
}

.state-dot.offline {
  background: #c27c2f;
  box-shadow: 0 0 0 6px rgba(194, 124, 47, 0.16);
}

.control-card,
.status-card {
  border-radius: 16px;
  border: 1px solid var(--line);
  margin-bottom: 12px;
}

.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.wifi-entry {
  min-height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  border-color: #cfe0d5;
  color: #2d8b57;
  background: #f5fbf7;
}

.wifi-tip {
  line-height: 1.55;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.mode-group {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
}

.mode-group .el-radio-button__inner {
  width: 100%;
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}

.threshold-tools {
  margin-top: -2px;
  margin-bottom: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.threshold-tools strong {
  margin-left: 4px;
  color: #2d8b57;
}

.threshold-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.threshold-sep {
  color: #748b7e;
  font-size: 13px;
}

.form-tip {
  margin-top: 8px;
}

.chips-control {
  margin-bottom: 12px;
}

.threshold-alert {
  margin-top: 12px;
}

@media (max-width: 374px) {
  .device-select {
    width: 100%;
  }

  .tile-grid {
    grid-template-columns: 1fr;
  }

  .action-row {
    grid-template-columns: 1fr;
  }

  .card-header-row {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (min-width: 900px) {
  .page-bg {
    padding: 0;
  }

  .app-shell {
    max-width: none;
    padding: 22px;
  }

  .top-bar h1 {
    font-size: 1.75rem;
  }

  .main-grid {
    display: grid;
    grid-template-columns: 1.55fr 1fr;
    gap: 14px;
  }

  .tile-grid {
    gap: 12px;
  }
}
</style>

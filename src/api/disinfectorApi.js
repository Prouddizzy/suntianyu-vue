const API_BASE = process.env.VUE_APP_API_BASE_URL || "/api/v1";
const USE_MOCK_API = process.env.VUE_APP_USE_MOCK_API === "true";
const mockWifiConfigs = {};

const mockState = {
  deviceId: "STM-001",
  machineRunning: false,
  selectedMode: "智能模式",
  duration: 20,
  temperature: 27.3,
  humidity: 53.6,
  heaterOn: false,
  disinfectionOn: false,
  fanOn: false,
  paused: false,
  tempLow: 18,
  tempHigh: 34,
  humidityLow: 45,
  humidityHigh: 65,
  doorOpen: false,
  remainingSeconds: 0,
  updatedAt: new Date().toISOString(),
};

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function buildRequestUrl(path, query = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, value);
    }
  });

  const queryString = searchParams.toString();
  return `${API_BASE}${path}${queryString ? `?${queryString}` : ""}`;
}

async function request(path, options = {}) {
  let response;
  const { query, ...requestOptions } = options;
  const requestUrl = buildRequestUrl(path, query);

  try {
    response = await fetch(requestUrl, {
      headers: {
        "Content-Type": "application/json",
        ...(requestOptions.headers || {}),
      },
      ...requestOptions,
    });
  } catch (error) {
    throw new Error("服务器未响应");
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error("服务器响应格式错误");
  }
}

function simulateStatusTick() {
  if (mockState.machineRunning && !mockState.paused) {
    if (mockState.heaterOn) {
      mockState.temperature += 0.2 + Math.random() * 0.2;
    } else {
      mockState.temperature -= 0.08 + Math.random() * 0.1;
    }

    if (mockState.fanOn) {
      mockState.humidity -= 0.25 + Math.random() * 0.2;
      mockState.temperature -= 0.05;
    } else {
      mockState.humidity += (Math.random() - 0.45) * 0.3;
    }

    if (mockState.selectedMode === "智能模式") {
      const tempTooHigh = mockState.temperature > mockState.tempHigh;
      const tempTooLow = mockState.temperature < mockState.tempLow;
      const humidityTooHigh = mockState.humidity > mockState.humidityHigh;

      mockState.disinfectionOn = true;
      if (tempTooHigh) {
        mockState.heaterOn = false;
      } else if (tempTooLow) {
        mockState.heaterOn = true;
      }

      mockState.fanOn = humidityTooHigh || tempTooHigh;
    }

    if (mockState.remainingSeconds > 0) {
      mockState.remainingSeconds -= 2;
      if (mockState.remainingSeconds <= 0 && mockState.selectedMode !== "智能模式") {
        mockState.machineRunning = false;
        mockState.paused = false;
        mockState.heaterOn = false;
        mockState.disinfectionOn = false;
        mockState.fanOn = false;
        mockState.remainingSeconds = 0;
      }
    }
  } else {
    mockState.temperature += (27 - mockState.temperature) * 0.08;
    mockState.humidity += (55 - mockState.humidity) * 0.08;
  }

  mockState.temperature = Number(Math.min(60, Math.max(10, mockState.temperature)).toFixed(1));
  mockState.humidity = Number(Math.min(95, Math.max(20, mockState.humidity)).toFixed(1));
  mockState.updatedAt = new Date().toISOString();
}

export const disinfectorApi = {
  async getRuntimeStatus(deviceId = "STM-001") {
    if (USE_MOCK_API) {
      await delay(120);
      mockState.deviceId = deviceId;
      simulateStatusTick();
      return {
        code: 0,
        message: "ok",
        data: { ...mockState, deviceId },
      };
    }

    return request("/disinfector/runtime-status", {
      method: "GET",
      query: { deviceId },
    });
  },

  async getConfig(deviceId = "STM-001") {
    if (USE_MOCK_API) {
      await delay(80);
      return {
        code: 0,
        message: "ok",
        data: {
          deviceId,
          tempLow: mockState.tempLow,
          tempHigh: mockState.tempHigh,
          humidityLow: mockState.humidityLow,
          humidityHigh: mockState.humidityHigh,
        },
      };
    }

    return request("/disinfector/config", {
      method: "GET",
      query: { deviceId },
    });
  },

  async updateThresholds(deviceId = "STM-001", payload) {
    if (USE_MOCK_API) {
      await delay(100);
      mockState.deviceId = deviceId;
      mockState.tempLow = payload.tempLow;
      mockState.tempHigh = payload.tempHigh;
      mockState.humidityLow = payload.humidityLow;
      mockState.humidityHigh = payload.humidityHigh;
      return {
        code: 0,
        message: "ok",
        data: {
          deviceId,
          tempLow: mockState.tempLow,
          tempHigh: mockState.tempHigh,
          humidityLow: mockState.humidityLow,
          humidityHigh: mockState.humidityHigh,
        },
      };
    }

    return request("/disinfector/thresholds", {
      method: "PUT",
      query: { deviceId },
      body: JSON.stringify(payload),
    });
  },

  async updateWifiConfig(deviceId = "STM-001", payload) {
    if (USE_MOCK_API) {
      await delay(120);
      mockWifiConfigs[deviceId] = {
        ssid: payload.ssid,
        password: payload.password,
      };
      return {
        code: 0,
        message: "ok",
        data: {
          deviceId,
          ssid: mockWifiConfigs[deviceId].ssid,
          appliedAfterRestart: true,
        },
      };
    }

    return request("/disinfector/wifi-config", {
      method: "PUT",
      query: { deviceId },
      body: JSON.stringify(payload),
    });
  },

  async startTask(deviceId = "STM-001", payload) {
    if (USE_MOCK_API) {
      await delay(120);
      mockState.deviceId = deviceId;
      mockState.machineRunning = true;
      mockState.paused = false;
      mockState.selectedMode = payload.mode;
      mockState.duration = payload.duration;
      mockState.remainingSeconds = payload.mode === "智能模式" ? 0 : payload.duration * 60;
      if (payload.mode === "加热模式") {
        mockState.heaterOn = true;
        mockState.disinfectionOn = false;
        mockState.fanOn = false;
      } else if (payload.mode === "消毒模式") {
        mockState.heaterOn = false;
        mockState.disinfectionOn = true;
        mockState.fanOn = false;
      } else {
        mockState.heaterOn = true;
        mockState.disinfectionOn = true;
        mockState.fanOn = false;
      }
      return {
        code: 0,
        message: "ok",
        data: { ...mockState, deviceId },
      };
    }

    return request("/disinfector/tasks/start", {
      method: "POST",
      query: { deviceId },
      body: JSON.stringify(payload),
    });
  },

  async stopTask(deviceId = "STM-001") {
    if (USE_MOCK_API) {
      await delay(100);
      mockState.deviceId = deviceId;
      mockState.machineRunning = false;
      mockState.paused = false;
      mockState.heaterOn = false;
      mockState.disinfectionOn = false;
      mockState.fanOn = false;
      mockState.remainingSeconds = 0;
      return {
        code: 0,
        message: "ok",
        data: { ...mockState, deviceId },
      };
    }

    return request("/disinfector/tasks/stop", {
      method: "POST",
      query: { deviceId },
    });
  },

  async pauseTask(deviceId = "STM-001", payload) {
    if (USE_MOCK_API) {
      await delay(100);
      mockState.deviceId = deviceId;
      const action = payload?.action || "pause";
      if (!mockState.machineRunning) {
        return {
          code: 1004,
          message: "machine is idle",
          data: { ...mockState, deviceId },
        };
      }

      if (action === "pause") {
        mockState.paused = true;
        mockState.heaterOn = false;
        mockState.disinfectionOn = false;
        mockState.fanOn = false;
      } else {
        mockState.paused = false;
        if (mockState.selectedMode === "加热模式") {
          mockState.heaterOn = true;
          mockState.disinfectionOn = false;
          mockState.fanOn = false;
        } else if (mockState.selectedMode === "消毒模式") {
          mockState.heaterOn = false;
          mockState.disinfectionOn = true;
          mockState.fanOn = false;
        } else {
          mockState.heaterOn = true;
          mockState.disinfectionOn = true;
          mockState.fanOn = false;
        }
      }

      return {
        code: 0,
        message: "ok",
        data: { ...mockState, deviceId },
      };
    }

    return request("/disinfector/tasks/pause", {
      method: "POST",
      query: { deviceId },
      body: JSON.stringify(payload),
    });
  },
};

export const apiMeta = {
  apiBase: API_BASE,
  useMockApi: USE_MOCK_API,
};

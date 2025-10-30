import { useStore } from '../state/store';

interface DeviceSelectProps {
  devices: MediaDeviceInfo[];
}

export default function DeviceSelect({ devices }: DeviceSelectProps) {
  const { selectedDeviceId, setSelectedDevice } = useStore();

  return (
    <select
      value={selectedDeviceId || ''}
      onChange={(e) => setSelectedDevice(e.target.value || null)}
      className="device-select"
    >
      {devices.length === 0 ? (
        <option value="">No devices</option>
      ) : (
        devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Device ${device.deviceId.slice(0, 8)}`}
          </option>
        ))
      )}
    </select>
  );
}


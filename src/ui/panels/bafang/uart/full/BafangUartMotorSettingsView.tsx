import React from 'react';
import path from 'path';
import { listPresetFiles, loadSettingsFile, saveSettingsFile, SettingsObject, SettingsMetadata } from '../../../../../utils/settingsLoader';
import {
    Typography,
    Descriptions,
    Select,
    FloatButton,
    message,
    Switch,
    Popconfirm,
    Button,
    Dropdown,
    Tooltip,
} from 'antd';
import type { DescriptionsProps } from 'antd';
import { SyncOutlined, DeliveredProcedureOutlined, ExclamationCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import BafangUartMotor from '../../../../../device/high-level/BafangUartMotor';
import {
    AssistLevel,
    AssistLevelOptions,
    BafangUartMotorBasicParameters,
    BafangUartMotorInfo,
    BafangUartMotorPedalParameters,
    BafangUartMotorThrottleParameters,
    ParameterNames,
    PedalType,
    PedalTypeOptions,
    SpeedLimitByDisplay,
    SpeedmeterType,
    SpeedmeterTypeOptions,
    ThrottleMode,
    ThrottleModeOptions,
} from '../../../../../types/BafangUartMotorTypes';
import { lowVoltageLimits } from '../../../../../constants/parameter_limits';
import ParameterInputComponent from '../../../../components/ParameterInput';
import StringValueComponent from '../../../../components/StringValueComponent';
import {
    generateAnnotatedEditableNumberListItem,
    generateAnnotatedEditableNumberListItemWithWarning,
    generateEditableNumberListItem,
    generateEditableNumberListItemWithWarning,
    generateEditableSelectListItem,
    generateSimpleStringListItem,
} from '../../../../utils/UIUtils';
import AssistLevelTableComponent from '../../../../components/AssistLevelTableComponent';
import i18n from '../../../../../i18n/i18n';

const { Title } = Typography;

type SettingsProps = {
    connection: BafangUartMotor;
};

type SettingsState = BafangUartMotorInfo &
    BafangUartMotorBasicParameters &
    BafangUartMotorPedalParameters &
    BafangUartMotorThrottleParameters & {
        pedal_speed_limit_unit: string;
        throttle_speed_limit_unit: string;
        lastUpdateTime: number;
        oldStyle: boolean;
        presetFiles: string[];
        selectedPreset: string;
        presetMetadata: Map<string, SettingsMetadata>;
        selectedPresetInfo: { description?: string; author?: string; } | null;
    };

/* eslint-disable camelcase */
class BafangUartMotorSettingsView extends React.Component<
    SettingsProps,
    SettingsState
> {
    private initial_info: BafangUartMotorInfo;

    private initial_basic_parameters: BafangUartMotorBasicParameters;

    private initial_pedal_parameters: BafangUartMotorPedalParameters;

    private initial_throttle_parameters: BafangUartMotorThrottleParameters;

    private packages_written: number;

    presetsDir = path.join(process.cwd(), 'Presets');

    constructor(props: SettingsProps) {
        super(props);
        const { connection } = this.props;
        this.initial_info = connection.getInfo();
        this.initial_basic_parameters = connection.getBasicParameters();
        this.initial_pedal_parameters = connection.getPedalParameters();
        this.initial_throttle_parameters = connection.getThrottleParameters();
        this.packages_written = 0;
        this.getElectricalParameterItems = this.getElectricalParameterItems.bind(this);
        this.getPhysicalParameterItems = this.getPhysicalParameterItems.bind(this);
        this.getDriveParameterItems = this.getDriveParameterItems.bind(this);
        this.getOtherItems = this.getOtherItems.bind(this);
        this.saveParameters = this.saveParameters.bind(this);
        this.updateData = this.updateData.bind(this);
        this.onWriteSuccess = this.onWriteSuccess.bind(this);
        this.onWriteError = this.onWriteError.bind(this);
        this.handlePresetSelect = this.handlePresetSelect.bind(this);
        this.handlePresetLoadFromDropdown = this.handlePresetLoadFromDropdown.bind(this);
        this.handlePresetLoadFromFile = this.handlePresetLoadFromFile.bind(this);
        this.handlePresetSave = this.handlePresetSave.bind(this);
        this.state = {
            ...this.initial_info,
            ...this.initial_basic_parameters,
            ...this.initial_pedal_parameters,
            ...this.initial_throttle_parameters,
            pedal_speed_limit_unit:
                this.initial_pedal_parameters.pedal_speed_limit === SpeedLimitByDisplay ? 'by_display' : 'kmh',
            throttle_speed_limit_unit:
                this.initial_throttle_parameters.throttle_speed_limit === SpeedLimitByDisplay ? 'by_display' : 'kmh',
            lastUpdateTime: 0,
            oldStyle: false,
            presetFiles: this.getInitialPresetFiles(),
            selectedPreset: '',
            presetMetadata: new Map(),
            selectedPresetInfo: null,
        };
        connection.emitter.removeAllListeners('write-success');
        connection.emitter.removeAllListeners('write-error');
        connection.emitter.on('data', this.updateData);
        connection.emitter.on('write-success', this.onWriteSuccess);
        connection.emitter.on('write-error', this.onWriteError);
    }

    getInitialPresetFiles(): string[] {
        try {
            return listPresetFiles(this.presetsDir);
        } catch (err) {
            console.warn('Failed to load preset files:', err);
            return [];
        }
    }

    loadPresetMetadata(): void {
        const metadataMap = new Map();
        this.state.presetFiles.forEach(filePath => {
            try {
                const settings = loadSettingsFile(filePath);
                if (settings.metadata) {
                    metadataMap.set(filePath, settings.metadata);
                }
            } catch (err) {
                console.warn(`Failed to load metadata for ${filePath}:`, err);
            }
        });
        this.setState({ presetMetadata: metadataMap });
    }

    componentDidMount(): void {
        this.loadPresetMetadata();
    }

    parseTxtSettings(content: string): SettingsObject {
        const lines = content.split(/\r?\n/);
        const result: SettingsObject = {};
        let currentSection = '';
        for (const line of lines) {
            if (line.trim().startsWith('[') && line.trim().endsWith(']')) {
                currentSection = line.trim().slice(1, -1);
                result[currentSection] = {};
            } else if (line.includes('=') && currentSection && result[currentSection]) {
                const [key, value] = line.split('=', 2);
                const numValue = Number(value.trim());
                if (!isNaN(numValue)) {
                    (result[currentSection] as Record<string, number>)[key.trim()] = numValue;
                } else {
                    console.warn(`Invalid number for key "${key.trim()}" in section "[${currentSection}]": "${value.trim()}"`);
                }
            }
        }
        return result;
    }

    handlePresetSelect(preset: string): void {
        const metadata = this.state.presetMetadata.get(preset);
        const selectedPresetInfo = metadata ? {
            description: metadata.description,
            author: metadata.author,
        } : null;
        this.setState({ 
            selectedPreset: preset,
            selectedPresetInfo: selectedPresetInfo 
        });
    }

    handlePresetLoadFromDropdown(): void {
        const { selectedPreset } = this.state;
        if (!selectedPreset) return;
        try {
            const settings: SettingsObject = loadSettingsFile(selectedPreset);
            const basic = (settings.Basic || {}) as Record<string, number>;
            const pedal = ((settings['Pedal Assist'] || settings.Pedal_Assist) || {}) as Record<string, number>;
            const throttle = ((settings['Throttle Handle'] || settings.Throttle_Handle) || {}) as Record<string, number>;
            this.setState({
                low_battery_protection: basic.LBP ?? this.state.low_battery_protection,
                current_limit: basic.LC ?? this.state.current_limit,
                wheel_diameter: basic.WD ?? this.state.wheel_diameter,
                magnets_per_wheel_rotation: basic.SMM ?? this.state.magnets_per_wheel_rotation,
                speedmeter_type: basic.SMS ?? this.state.speedmeter_type,
                pedal_type: pedal.PT ?? this.state.pedal_type,
                pedal_assist_level: pedal.DA ?? this.state.pedal_assist_level,
                pedal_speed_limit: pedal.SL ?? this.state.pedal_speed_limit,
                throttle_start_voltage: throttle.SV ?? this.state.throttle_start_voltage,
                throttle_end_voltage: throttle.EV ?? this.state.throttle_end_voltage,
                throttle_mode: throttle.MODE ?? this.state.throttle_mode,
            });
            // Show metadata information if available
            if (settings.metadata) {
                const meta = settings.metadata;
                const metaInfo = [];
                if (meta.name) metaInfo.push(`Name: ${meta.name}`);
                if (meta.description) metaInfo.push(`Description: ${meta.description}`);
                if (meta.version) metaInfo.push(`Version: ${meta.version}`);
                if (meta.author) metaInfo.push(`Author: ${meta.author}`);
                if (meta.created) metaInfo.push(`Created: ${meta.created}`);
                
                if (metaInfo.length > 0) {
                    message.success(`Preset loaded: ${path.basename(selectedPreset)}\n${metaInfo.join(' | ')}`, 5);
                } else {
                    message.success(`Preset loaded: ${path.basename(selectedPreset)}`);
                }
            } else {
                message.success(`Preset loaded: ${path.basename(selectedPreset)}`);
            }
        } catch (e: any) {
            // Log the error for debugging
            // eslint-disable-next-line no-console
            console.error('Error loading preset:', e);
            message.error(`Failed to load preset: ${e.message || e}`);
        }
    }

    handlePresetLoadFromFile(): void {
        // Create a hidden file input element
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.toml,.txt';
        input.style.display = 'none';
        
        input.onchange = (event: Event) => {
            const target = event.target as HTMLInputElement;
            const file = target.files?.[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target?.result as string;
                    // Create a temporary file path for compatibility with loadSettingsFile
                    const tempFilePath = file.name;
                    
                    // Parse the content directly instead of using loadSettingsFile
                    let settings: SettingsObject;
                    try {
                        const toml = require('@iarna/toml');
                        settings = toml.parse(content) as SettingsObject;
                    } catch (e) {
                        // Fallback: parse TXT format
                        settings = this.parseTxtSettings(content);
                    }
                    
                    const basic = (settings.Basic || {}) as Record<string, number>;
                    const pedal = ((settings['Pedal Assist'] || settings.Pedal_Assist) || {}) as Record<string, number>;
                    const throttle = ((settings['Throttle Handle'] || settings.Throttle_Handle) || {}) as Record<string, number>;
                    
                    this.setState({
                        low_battery_protection: basic.LBP ?? this.state.low_battery_protection,
                        current_limit: basic.LC ?? this.state.current_limit,
                        wheel_diameter: basic.WD ?? this.state.wheel_diameter,
                        magnets_per_wheel_rotation: basic.SMM ?? this.state.magnets_per_wheel_rotation,
                        speedmeter_type: basic.SMS ?? this.state.speedmeter_type,
                        pedal_type: pedal.PT ?? this.state.pedal_type,
                        pedal_assist_level: pedal.DA ?? this.state.pedal_assist_level,
                        pedal_speed_limit: pedal.SL ?? this.state.pedal_speed_limit,
                        throttle_start_voltage: throttle.SV ?? this.state.throttle_start_voltage,
                        throttle_end_voltage: throttle.EV ?? this.state.throttle_end_voltage,
                        throttle_mode: throttle.MODE ?? this.state.throttle_mode,
                    });
                    
                    // Show metadata information if available
                    if (settings.metadata) {
                        const meta = settings.metadata;
                        const metaInfo = [];
                        if (meta.name) metaInfo.push(`Name: ${meta.name}`);
                        if (meta.description) metaInfo.push(`Description: ${meta.description}`);
                        if (meta.version) metaInfo.push(`Version: ${meta.version}`);
                        if (meta.author) metaInfo.push(`Author: ${meta.author}`);
                        if (meta.created) metaInfo.push(`Created: ${meta.created}`);
                        
                        if (metaInfo.length > 0) {
                            message.success(`Preset loaded: ${file.name}\n${metaInfo.join(' | ')}`, 5);
                        } else {
                            message.success(`Preset loaded from: ${file.name}`);
                        }
                    } else {
                        message.success(`Preset loaded from: ${file.name}`);
                    }
                } catch (e: any) {
                    // eslint-disable-next-line no-console
                    console.error('Error parsing preset:', e);
                    message.error(`Failed to parse preset: ${e.message || e}`);
                }
            };
            
            reader.onerror = () => {
                message.error('Failed to read file');
            };
            
            reader.readAsText(file);
            document.body.removeChild(input);
        };
        
        document.body.appendChild(input);
        input.click();
    }

    handlePresetSave(): void {
        try {
            const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            const settings: SettingsObject = {
                metadata: {
                    name: "Custom Motor Configuration",
                    description: "Custom configuration exported from OpenBafangTool",
                    version: "1.0",
                    author: "User",
                    created: currentDate,
                },
                Basic: {
                    LBP: this.state.low_battery_protection,
                    LC: this.state.current_limit,
                    WD: this.state.wheel_diameter,
                    SMM: this.state.magnets_per_wheel_rotation,
                    SMS: this.state.speedmeter_type,
                },
                'Pedal Assist': {
                    PT: this.state.pedal_type,
                    DA: this.state.pedal_assist_level,
                    SL: this.state.pedal_speed_limit,
                },
                'Throttle Handle': {
                    SV: this.state.throttle_start_voltage,
                    EV: this.state.throttle_end_voltage,
                    MODE: this.state.throttle_mode,
                },
            };
            
            // Convert to TOML format
            const toml = require('@iarna/toml');
            const tomlString = toml.stringify(settings);
            
            // Create and trigger download
            const blob = new Blob([tomlString], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'motor-settings.toml';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            message.success('Preset saved to Downloads folder as motor-settings.toml');
        } catch (e) {
            // Log the error for debugging
            // eslint-disable-next-line no-console
            console.error('Failed to save preset:', e);
            message.error(`Failed to save preset: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    onWriteSuccess(pkg_code: string): void {
        // eslint-disable-next-line react/destructuring-assignment, react/no-access-state-in-setstate
        this.packages_written++;
        message.success(`${ParameterNames[pkg_code]} written successfull`);
    }

    onWriteError(parameter_code: string): void {
        message.error(`${ParameterNames[parameter_code]} write error`);
    }

    getElectricalParameterItems(): DescriptionsProps['items'] {
        return [
            generateEditableNumberListItemWithWarning(
                i18n.t('battery_low_limit'),
                this.state.low_battery_protection,
                i18n.t('battery_low_limit_warning', {
                    min: lowVoltageLimits[this.state.voltage].min,
                    max: lowVoltageLimits[this.state.voltage].max,
                }),
                lowVoltageLimits[this.state.voltage].min,
                lowVoltageLimits[this.state.voltage].max,
                (low_battery_protection) =>
                    this.setState({ low_battery_protection }),
                i18n.t('v'),
                0,
                100,
            ),
            generateEditableNumberListItem(
                i18n.t('current_limit'),
                this.state.current_limit,
                (current_limit) => this.setState({ current_limit }),
                i18n.t('a'),
                1,
                this.state.max_current,
            ),
            generateEditableNumberListItemWithWarning(
                'Pedal start current',
                this.state.pedal_start_current,
                'Its not recommended to set high pedal start current',
                1,
                30,
                (pedal_start_current) => this.setState({ pedal_start_current }),
                '%',
                1,
                100,
            ),
            generateEditableNumberListItemWithWarning(
                i18n.t('throttle_start_voltage'),
                this.state.throttle_start_voltage,
                i18n.t('throttle_start_voltage_warning'),
                1.1,
                20,
                (throttle_start_voltage) =>
                    this.setState({ throttle_start_voltage }),
                i18n.t('v'),
                1,
                20,
                1,
            ),
            generateEditableNumberListItemWithWarning(
                'Throttle end voltage',
                this.state.throttle_end_voltage,
                'Its not recommended to set lower end voltage than 1.1V',
                1.1,
                20,
                (throttle_end_voltage) =>
                    this.setState({ throttle_end_voltage }),
                i18n.t('v'),
                1,
                20,
                1,
            ),
            generateEditableNumberListItemWithWarning(
                'Throttle start current',
                this.state.throttle_start_current,
                'Its not recommended to set lower start current than 10% and higher than 20%',
                10,
                20,
                (throttle_start_current) =>
                    this.setState({ throttle_start_current }),
                '%',
                1,
                100,
            ),
        ];
    }

    getPhysicalParameterItems(): DescriptionsProps['items'] {
        return [
            {
                key: 'wheel_diameter',
                label: (
                    <>
                        {i18n.t('wheel_diameter')}
                        <Tooltip title="NEVER try to set wrong wheel diameter - its illegal, because it will lead to incorrect speed measurement">
                            <ExclamationCircleOutlined 
                                style={{ 
                                    color: 'red', 
                                    marginLeft: '8px', 
                                    cursor: 'pointer' 
                                }} 
                            />
                        </Tooltip>
                    </>
                ),
                children: (
                    <ParameterInputComponent
                        value={this.state.wheel_diameter}
                        unit="″"
                        min={1}
                        max={100}
                        onNewValue={(wheel_diameter) => this.setState({ wheel_diameter })}
                        warningText={i18n.t('wheel_diameter_warning')}
                        warningBelow={12}
                        warningAbove={29}
                    />
                ),
            },
            {
                key: 'magnets_per_wheel_rotation',
                label: (
                    <>
                        Number of speed meter magnets on wheel
                        <Tooltip title="NEVER try to set wrong magnet number - it may be illegal, because it will lead to incorrect speed measurement">
                            <ExclamationCircleOutlined 
                                style={{ 
                                    color: 'red', 
                                    marginLeft: '8px', 
                                    cursor: 'pointer' 
                                }} 
                            />
                        </Tooltip>
                    </>
                ),
                children: (
                    <ParameterInputComponent
                        value={this.state.magnets_per_wheel_rotation}
                        unit=""
                        min={1}
                        max={10}
                        onNewValue={(magnets_per_wheel_rotation) =>
                            this.setState({ magnets_per_wheel_rotation })
                        }
                        warningText="Normally bike have only one speed meter magnet. Incorrect value of this setting will lead to incorrect speed measuring"
                        warningBelow={1}
                        warningAbove={1}
                    />
                ),
            },
            generateEditableSelectListItem(
                'Speedmeter type',
                SpeedmeterTypeOptions,
                this.state.speedmeter_type,
                (e) => this.setState({ speedmeter_type: e as SpeedmeterType }),
            ),
            generateEditableSelectListItem(
                'Pedal sensor type',
                PedalTypeOptions,
                this.state.pedal_type,
                (e) => this.setState({ pedal_type: e as PedalType }),
            ),
        ];
    }

    getDriveParameterItems(): DescriptionsProps['items'] {
        const {
            pedal_speed_limit,
            pedal_time_to_stop,
            pedal_stop_decay,
            pedal_speed_limit_unit,
            throttle_speed_limit,
            throttle_speed_limit_unit,
        } = this.state;
        return [
            generateEditableSelectListItem(
                'Throttle mode',
                ThrottleModeOptions,
                this.state.throttle_mode,
                (e) => this.setState({ throttle_mode: e as ThrottleMode }),
            ),
            generateEditableSelectListItem(
                'Pedal assist level (Designated Assist)',
                AssistLevelOptions,
                this.state.pedal_assist_level,
                (e) => this.setState({ pedal_assist_level: e as AssistLevel }),
            ),
            generateEditableSelectListItem(
                'Throttle assist level (Designated Assist)',
                AssistLevelOptions,
                this.state.throttle_assist_level,
                (e) =>
                    this.setState({ throttle_assist_level: e as AssistLevel }),
            ),
            {
                key: 'pedal_speed_limit',
                label: 'Pedal speed limit',
                children: (
                    <ParameterInputComponent
                        value={
                            pedal_speed_limit === SpeedLimitByDisplay
                                ? null
                                : pedal_speed_limit
                        }
                        nullIsOk
                        unit={
                            <Select
                                style={{ minWidth: '100px' }}
                                defaultValue={
                                    pedal_speed_limit === SpeedLimitByDisplay
                                        ? 'by_display'
                                        : 'kmh'
                                }
                                options={[
                                    { value: 'kmh', label: i18n.t('km/h') },
                                    {
                                        value: 'by_display',
                                        label: i18n.t('by_display'),
                                    },
                                ]}
                                onChange={(value) =>
                                    this.setState({
                                        pedal_speed_limit:
                                            value === 'by_display'
                                                ? SpeedLimitByDisplay
                                                : 25,
                                        pedal_speed_limit_unit: value,
                                    })
                                }
                            />
                        }
                        min={1}
                        max={60}
                        onNewValue={(e) => {
                            this.setState({
                                pedal_speed_limit:
                                    pedal_speed_limit_unit === 'by_display'
                                        ? SpeedLimitByDisplay
                                        : e,
                            });
                        }}
                        warningText="Its illegal in most countries to set speed limit bigger than 25km/h"
                        warningBelow={0}
                        warningAbove={25}
                        disabled={pedal_speed_limit_unit === 'by_display'}
                    />
                ),
            },
            {
                key: 'throttle_speed_limit',
                label: 'Throttle speed limit',
                children: (
                    <ParameterInputComponent
                        value={
                            throttle_speed_limit === SpeedLimitByDisplay
                                ? null
                                : throttle_speed_limit
                        }
                        nullIsOk
                        unit={
                            <Select
                                style={{ minWidth: '100px' }}
                                defaultValue={
                                    throttle_speed_limit === SpeedLimitByDisplay
                                        ? 'by_display'
                                        : 'kmh'
                                }
                                options={[
                                    { value: 'kmh', label: i18n.t('km/h') },
                                    {
                                        value: 'by_display',
                                        label: i18n.t('by_display'),
                                    },
                                ]}
                                onChange={(value) =>
                                    this.setState({
                                        throttle_speed_limit:
                                            value === 'by_display'
                                                ? SpeedLimitByDisplay
                                                : 5,
                                        throttle_speed_limit_unit: value,
                                    })
                                }
                            />
                        }
                        min={1}
                        max={60}
                        onNewValue={(e) => {
                            this.setState({
                                throttle_speed_limit:
                                    throttle_speed_limit_unit === 'by_display'
                                        ? SpeedLimitByDisplay
                                        : e,
                            });
                        }}
                        warningText="Its illegal in most countries to use throttle"
                        warningBelow={0}
                        warningAbove={0}
                        disabled={throttle_speed_limit_unit === 'by_display'}
                    />
                ),
            },
            generateEditableNumberListItemWithWarning(
                'Slow start mode',
                this.state.pedal_slow_start_mode,
                'Its not recommended to set slow start mode less than 3 (it can damage controller) and bigger than 5 (start will to slow)',
                3,
                5,
                (pedal_slow_start_mode) =>
                    this.setState({ pedal_slow_start_mode }),
                '',
                1,
                8,
            ),
            generateEditableNumberListItemWithWarning(
                'Signals before assist (Start Degree, Signal No.)',
                this.state.pedal_signals_before_start,
                'Its not recommended to set this parameter lower than 2 and bigger than number of signals per one rotation for your pedal sensor',
                2,
                32,
                (pedal_signals_before_start) =>
                    this.setState({ pedal_signals_before_start }),
                '',
                1,
                100,
            ),
            {
                key: 'time_before_end_of_assist',
                label: 'Time before end of assist (Time Of Stop, Stop Delay)',
                children: (
                    <ParameterInputComponent
                        value={pedal_time_to_stop}
                        unit={i18n.t('ms')}
                        min={1}
                        max={1000}
                        onNewValue={(e) => {
                            this.setState({
                                pedal_time_to_stop: e - (e % 10),
                            });
                        }}
                        warningText="Its not recommended to set this parameter lower than 50 and bigger than 250"
                        warningBelow={50}
                        warningAbove={250}
                    />
                ),
            },
            generateEditableNumberListItemWithWarning(
                'Current decay',
                this.state.pedal_current_decay,
                'Its not recommended to set this parameter lower than 4 and bigger than 8',
                4,
                8,
                (pedal_current_decay) => this.setState({ pedal_current_decay }),
                '',
                1,
                100,
            ),
            {
                key: 'stop_decay',
                label: i18n.t('pedal_stop_decay'),
                children: (
                    <ParameterInputComponent
                        value={pedal_stop_decay}
                        unit={i18n.t('ms')}
                        min={0}
                        max={500}
                        onNewValue={(e) => {
                            this.setState({
                                pedal_stop_decay: e - (e % 10),
                            });
                        }}
                        warningText="Its recommended to set this parameter to 0"
                        warningBelow={0}
                        warningAbove={200}
                    />
                ),
            },
            generateEditableNumberListItemWithWarning(
                'Keep current',
                this.state.pedal_keep_current,
                'Its recommended to keep this parameter in range 30-80',
                30,
                80,
                (pedal_keep_current) => this.setState({ pedal_keep_current }),
                '%',
                1,
                100,
            ),
        ];
    }

    getOtherItems(): DescriptionsProps['items'] {
        return [
            {
                key: 'serial_number',
                label: (
                    <>
                        {i18n.t('serial_number')}
                        <Tooltip title={i18n.t('serial_number_warning')}>
                            <InfoCircleOutlined 
                                style={{ 
                                    color: '#1890ff', 
                                    marginLeft: '8px', 
                                    cursor: 'pointer' 
                                }} 
                            />
                        </Tooltip>
                    </>
                ),
                children: <StringValueComponent value={this.state.serial_number} />,
                contentStyle: { width: '50%' },
            },
        ];
    }

    getInfoItems(): DescriptionsProps['items'] {
        const {
            manufacturer,
            model,
            hardware_version,
            firmware_version,
            voltage,
            max_current,
        } = this.state;
        return [
            generateSimpleStringListItem(i18n.t('manufacturer'), manufacturer),
            generateSimpleStringListItem(i18n.t('model_number'), model),
            generateSimpleStringListItem(
                i18n.t('hardware_version'),
                hardware_version,
            ),
            generateSimpleStringListItem(
                i18n.t('software_version'),
                firmware_version,
            ),
            generateSimpleStringListItem(i18n.t('voltage'), voltage),
            generateSimpleStringListItem(i18n.t('max_current'), max_current),
        ];
    }

    getBasicParameterItems(): DescriptionsProps['items'] {
        return [
            generateEditableNumberListItemWithWarning(
                i18n.t('low_battery_protection'),
                this.state.low_battery_protection,
                i18n.t('battery_low_limit_warning', {
                    min: lowVoltageLimits[this.state.voltage].min,
                    max: lowVoltageLimits[this.state.voltage].max,
                }),
                lowVoltageLimits[this.state.voltage].min,
                lowVoltageLimits[this.state.voltage].max,
                (low_battery_protection) =>
                    this.setState({ low_battery_protection }),
                i18n.t('v'),
                0,
                100,
            ),
            generateEditableNumberListItem(
                i18n.t('current_limit'),
                this.state.current_limit,
                (current_limit) => this.setState({ current_limit }),
                i18n.t('a'),
                1,
                this.state.max_current,
            ),
            {
                key: 'wheel_diameter_basic',
                label: (
                    <>
                        {i18n.t('wheel_diameter')}
                        <Tooltip title="NEVER try to set wrong wheel diameter - its illegal, because it will lead to incorrect speed measurement">
                            <ExclamationCircleOutlined 
                                style={{ 
                                    color: 'red', 
                                    marginLeft: '8px', 
                                    cursor: 'pointer' 
                                }} 
                            />
                        </Tooltip>
                    </>
                ),
                children: (
                    <ParameterInputComponent
                        value={this.state.wheel_diameter}
                        unit="″"
                        min={1}
                        max={100}
                        onNewValue={(wheel_diameter) => this.setState({ wheel_diameter })}
                        warningText={i18n.t('wheel_diameter_warning')}
                        warningBelow={12}
                        warningAbove={29}
                    />
                ),
            },
            {
                key: 'speed_meter_signals',
                label: (
                    <>
                        Speed meter signals
                        <Tooltip title="NEVER try to set wrong magnet number - its illegal, because it will lead to incorrect speed measurement">
                            <ExclamationCircleOutlined 
                                style={{ 
                                    color: 'red', 
                                    marginLeft: '8px', 
                                    cursor: 'pointer' 
                                }} 
                            />
                        </Tooltip>
                    </>
                ),
                children: (
                    <ParameterInputComponent
                        value={this.state.magnets_per_wheel_rotation}
                        unit=""
                        min={1}
                        max={10}
                        onNewValue={(magnets_per_wheel_rotation) =>
                            this.setState({ magnets_per_wheel_rotation })
                        }
                        warningText="Normally bike have only one speed meter magnet. Incorrect value of this setting will lead to incorrect speed measuring"
                        warningBelow={1}
                        warningAbove={1}
                    />
                ),
            },
            generateEditableSelectListItem(
                'Speedmeter type',
                SpeedmeterTypeOptions,
                this.state.speedmeter_type,
                (e) => this.setState({ speedmeter_type: e as SpeedmeterType }),
            ),
        ];
    }

    getPedalParametersItems(): DescriptionsProps['items'] {
        const {
            pedal_speed_limit,
            pedal_speed_limit_unit,
            pedal_time_to_stop,
            pedal_stop_decay,
        } = this.state;
        return [
            generateEditableSelectListItem(
                'Pedal sensor type',
                PedalTypeOptions,
                this.state.pedal_type,
                (e) => this.setState({ pedal_type: e as PedalType }),
            ),
            generateEditableSelectListItem(
                'Designated assist level',
                AssistLevelOptions,
                this.state.pedal_assist_level,
                (e) => this.setState({ pedal_assist_level: e as AssistLevel }),
            ),
            {
                key: 'pedal_speed_limit',
                label: 'Speed limit',
                children: (
                    <ParameterInputComponent
                        value={
                            pedal_speed_limit === SpeedLimitByDisplay
                                ? null
                                : pedal_speed_limit
                        }
                        nullIsOk
                        unit={
                            <Select
                                style={{ minWidth: '100px' }}
                                defaultValue={
                                    pedal_speed_limit === SpeedLimitByDisplay
                                        ? 'by_display'
                                        : 'kmh'
                                }
                                options={[
                                    { value: 'kmh', label: i18n.t('km/h') },
                                    {
                                        value: 'by_display',
                                        label: i18n.t('by_display'),
                                    },
                                ]}
                                onChange={(value) =>
                                    this.setState({
                                        pedal_speed_limit:
                                            value === 'by_display'
                                                ? SpeedLimitByDisplay
                                                : 25,
                                        pedal_speed_limit_unit: value,
                                    })
                                }
                            />
                        }
                        min={1}
                        max={60}
                        onNewValue={(e) => {
                            this.setState({
                                pedal_speed_limit:
                                    pedal_speed_limit_unit === 'by_display'
                                        ? SpeedLimitByDisplay
                                        : e,
                            });
                        }}
                        warningText="Its illegal in most countries to set speed limit bigger than 25km/h"
                        warningBelow={0}
                        warningAbove={25}
                        disabled={pedal_speed_limit_unit === 'by_display'}
                    />
                ),
            },
            generateEditableNumberListItemWithWarning(
                'Start current',
                this.state.pedal_start_current,
                'Its not recommended to set high pedal start current',
                1,
                30,
                (pedal_start_current) => this.setState({ pedal_start_current }),
                '%',
                1,
                100,
            ),
            generateEditableNumberListItemWithWarning(
                'Slow start mode',
                this.state.pedal_slow_start_mode,
                'Its not recommended to set slow start mode less than 3 (it can damage controller) and bigger than 5 (start will to slow)',
                3,
                5,
                (pedal_slow_start_mode) =>
                    this.setState({ pedal_slow_start_mode }),
                '',
                1,
                8,
            ),
            generateEditableNumberListItemWithWarning(
                'Start degree (Signal No.)',
                this.state.pedal_signals_before_start,
                'Its not recommended to set this parameter lower than 2 and bigger than number of signals per one rotation for your pedal sensor',
                2,
                32,
                (pedal_signals_before_start) =>
                    this.setState({ pedal_signals_before_start }),
                '',
                1,
                100,
            ),
            {
                key: 'time_before_end_of_assist',
                label: 'Stop Delay',
                children: (
                    <ParameterInputComponent
                        value={Math.floor(pedal_time_to_stop / 10)}
                        unit="10ms"
                        min={1}
                        max={1000}
                        onNewValue={(e) => {
                            this.setState({
                                pedal_time_to_stop: e * 10,
                            });
                        }}
                        warningText="Its not recommended to set this parameter lower than 40 and bigger than 250"
                        warningBelow={5}
                        warningAbove={25}
                    />
                ),
            },
            generateEditableNumberListItemWithWarning(
                i18n.t('current_decay_old'),
                this.state.pedal_current_decay,
                'Its not recommended to set this parameter lower than 4 and bigger than 8',
                4,
                8,
                (pedal_current_decay) => this.setState({ pedal_current_decay }),
                '',
                1,
                100,
            ),
            {
                key: 'stop_decay',
                label: i18n.t('pedal_stop_decay_old'),
                children: (
                    <ParameterInputComponent
                        value={Math.floor(pedal_stop_decay / 10)}
                        unit="10ms"
                        min={0}
                        max={50}
                        onNewValue={(e) => {
                            this.setState({
                                pedal_stop_decay: e * 10,
                            });
                        }}
                        warningText="Its recommended to set this parameter to 0"
                        warningBelow={0}
                        warningAbove={0}
                    />
                ),
            },
            generateEditableNumberListItemWithWarning(
                'Keep current',
                this.state.pedal_keep_current,
                'Its recommended to keep this parameter in range 30-80',
                30,
                80,
                (pedal_keep_current) => this.setState({ pedal_keep_current }),
                '%',
                1,
                100,
            ),
        ];
    }

    getThrottleParametersItems(): DescriptionsProps['items'] {
        const {
            throttle_start_voltage,
            throttle_end_voltage,
            throttle_speed_limit,
            throttle_speed_limit_unit,
        } = this.state;
        return [
            {
                key: 'throttle_start_voltage',
                label: 'Start voltage',
                children: (
                    <ParameterInputComponent
                        value={throttle_start_voltage * 10}
                        unit={`100${i18n.t('mv')}`}
                        min={10}
                        max={1000}
                        onNewValue={(e) => {
                            this.setState({
                                throttle_start_voltage: e / 10,
                            });
                        }}
                        warningText="Its not recommended to set lower start voltage than 1.1V"
                        warningBelow={11}
                    />
                ),
            },
            {
                key: 'throttle_end_voltage',
                label: 'End voltage',
                children: (
                    <ParameterInputComponent
                        value={throttle_end_voltage * 10}
                        unit={`100${i18n.t('mv')}`}
                        min={10}
                        max={1000}
                        onNewValue={(e) => {
                            this.setState({
                                throttle_end_voltage: e / 10,
                            });
                        }}
                        warningText="Its not recommended to set lower end voltage than 1.1V"
                        warningBelow={11}
                    />
                ),
            },
            generateEditableSelectListItem(
                i18n.t('mode'),
                ThrottleModeOptions,
                this.state.throttle_mode,
                (e) => this.setState({ throttle_mode: e as ThrottleMode }),
            ),
            generateEditableSelectListItem(
                'Designated assist level',
                AssistLevelOptions,
                this.state.throttle_assist_level,
                (e) =>
                    this.setState({ throttle_assist_level: e as AssistLevel }),
            ),
            {
                key: 'throttle_speed_limit',
                label: 'Speed limit',
                children: (
                    <ParameterInputComponent
                        value={
                            throttle_speed_limit === SpeedLimitByDisplay
                                ? null
                                : throttle_speed_limit
                        }
                        nullIsOk
                        unit={
                            <Select
                                style={{ minWidth: '100px' }}
                                defaultValue={
                                    throttle_speed_limit === SpeedLimitByDisplay
                                        ? 'by_display'
                                        : 'kmh'
                                }
                                options={[
                                    { value: 'kmh', label: i18n.t('km/h') },
                                    {
                                        value: 'by_display',
                                        label: i18n.t('by_display'),
                                    },
                                ]}
                                onChange={(value) =>
                                    this.setState({
                                        throttle_speed_limit:
                                            value === 'by_display'
                                                ? SpeedLimitByDisplay
                                                : 5,
                                        throttle_speed_limit_unit: value,
                                    })
                                }
                            />
                        }
                        min={1}
                        max={60}
                        onNewValue={(e) => {
                            this.setState({
                                throttle_speed_limit:
                                    throttle_speed_limit_unit === 'by_display'
                                        ? SpeedLimitByDisplay
                                        : e,
                            });
                        }}
                        warningText="Its illegal in most countries to use throttle"
                        warningBelow={0}
                        warningAbove={0}
                        disabled={throttle_speed_limit_unit === 'by_display'}
                    />
                ),
            },
            generateEditableNumberListItemWithWarning(
                'Start current',
                this.state.throttle_start_current,
                'Its not recommended to set lower start current than 10% and higher than 20%',
                10,
                20,
                (throttle_start_current) =>
                    this.setState({ throttle_start_current }),
                '%',
                1,
                100,
            ),
        ];
    }

    updateData(): void {
        const { connection } = this.props;
        this.initial_info = connection.getInfo();
        this.initial_basic_parameters = connection.getBasicParameters();
        this.initial_pedal_parameters = connection.getPedalParameters();
        this.initial_throttle_parameters = connection.getThrottleParameters();
        this.setState({
            ...this.initial_info,
            ...this.initial_basic_parameters,
            ...this.initial_pedal_parameters,
            ...this.initial_throttle_parameters,
            lastUpdateTime: Date.now(),
        });
    }

    saveParameters(): void {
        const { connection } = this.props;
        const info: BafangUartMotorInfo = this.state as BafangUartMotorInfo;
        const basic_parameters: BafangUartMotorBasicParameters = this
            .state as BafangUartMotorBasicParameters;
        const pedal_parameters: BafangUartMotorPedalParameters = this
            .state as BafangUartMotorPedalParameters;
        const throttle_parameters: BafangUartMotorThrottleParameters = this
            .state as BafangUartMotorThrottleParameters;
        connection.setSerialNumber(info.serial_number);
        connection.setBasicParameters(basic_parameters);
        connection.setPedalParameters(pedal_parameters);
        connection.setThrottleParameters(throttle_parameters);
        this.packages_written = 0;
        connection.saveData();
        setTimeout(() => {
            if (this.packages_written === 3) {
                message.success('Parameters saved successfully!');
            } else {
                message.error('Error during writing!');
            }
        }, 3000);
    }

    render() {
        const { connection } = this.props;
        const { oldStyle } = this.state;
        const presetMenuItems = {
            onClick: ({ key }: { key: string }) => this.handlePresetSelect(key),
            selectedKeys: [this.state.selectedPreset],
            items: this.state.presetFiles.map((file) => {
                const metadata = this.state.presetMetadata.get(file);
                const displayName = metadata?.name || path.basename(file);
                return {
                    key: file,
                    label: displayName,
                };
            }),
        };
        return (
            <div style={{ margin: '36px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <Typography.Title level={2} style={{ margin: 0 }}>
                        {i18n.t('uart_motor_parameters_title')}
                    </Typography.Title>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Typography.Text>{i18n.t('old_style_layout')}</Typography.Text>
                        <Switch
                            checked={oldStyle}
                            onChange={(value) => this.setState({ oldStyle: value })}
                        />
                    </div>
                </div>
                <Descriptions
                    bordered
                    title="Files"
                    column={1}
                    style={{ marginBottom: '20px' }}
                    items={[
                        {
                            key: 'file_operations',
                            label: 'Operations',
                            children: (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <Button onClick={this.handlePresetLoadFromFile}>
                                        Load from File...
                                    </Button>
                                    <Button onClick={this.handlePresetSave}>
                                        Save to File...
                                    </Button>
                                </div>
                            ),
                        },
                        {
                            key: 'shipped_presets',
                            label: 'Presets',
                            children: (
                                <div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: this.state.selectedPresetInfo ? '8px' : '0' }}>
                                        <Dropdown menu={presetMenuItems} trigger={['click']}>
                                            <Button>
                                                {(() => {
                                                    if (!this.state.selectedPreset) return 'Select';
                                                    const metadata = this.state.presetMetadata.get(this.state.selectedPreset);
                                                    return metadata?.name || path.basename(this.state.selectedPreset);
                                                })()}
                                            </Button>
                                        </Dropdown>
                                        <Button onClick={this.handlePresetLoadFromDropdown} disabled={!this.state.selectedPreset}>
                                            Load Preset
                                        </Button>
                                    </div>
                                    {this.state.selectedPresetInfo && (
                                        <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                                            {this.state.selectedPresetInfo.description && (
                                                <div style={{ marginBottom: '4px' }}>
                                                    <strong>Description:</strong> {this.state.selectedPresetInfo.description}
                                                </div>
                                            )}
                                            {this.state.selectedPresetInfo.author && (
                                                <div>
                                                    <strong>Author:</strong> {this.state.selectedPresetInfo.author}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ),
                        },
                    ]}
                />
                {!oldStyle && (
                    <>
                        <Descriptions
                            bordered
                            title={i18n.t('electric_parameters')}
                            items={this.getElectricalParameterItems()}
                            column={1}
                            style={{ marginBottom: '20px' }}
                        />
                        <Descriptions
                            bordered
                            title={i18n.t('mechanical_parameters')}
                            items={this.getPhysicalParameterItems()}
                            column={1}
                            style={{ marginBottom: '20px' }}
                        />
                        <Title level={5}>{i18n.t('assist_table_title')}</Title>
                        <AssistLevelTableComponent
                            assist_profiles={this.state.assist_profiles}
                            onChange={(assist_profiles) =>
                                this.setState({ assist_profiles })
                            }
                            zero_level
                        />
                        <Descriptions
                            bordered
                            title={i18n.t('driving_parameters')}
                            items={this.getDriveParameterItems()}
                            column={1}
                            style={{ marginBottom: '20px' }}
                        />
                        <Descriptions
                            bordered
                            title={i18n.t('version_list_title')}
                            items={this.getOtherItems()}
                            column={1}
                        />
                    </>
                )}
                {oldStyle && (
                    <>
                        <Descriptions
                            bordered
                            title={i18n.t('info')}
                            items={this.getInfoItems()}
                            column={1}
                            style={{ marginBottom: '20px' }}
                        />
                        <Descriptions
                            bordered
                            title={i18n.t('basic_parameters')}
                            items={this.getBasicParameterItems()}
                            column={1}
                            style={{ marginBottom: '20px' }}
                        />
                        <AssistLevelTableComponent
                            assist_profiles={this.state.assist_profiles}
                            onChange={(assist_profiles) =>
                                this.setState({ assist_profiles })
                            }
                            zero_level
                        />
                        <Descriptions
                            bordered
                            title={i18n.t('pedal_parameters')}
                            items={this.getPedalParametersItems()}
                            column={1}
                            style={{ marginBottom: '20px' }}
                        />
                        <Descriptions
                            bordered
                            title={i18n.t('throttle_parameters')}
                            items={this.getThrottleParametersItems()}
                            column={1}
                        />
                    </>
                )}
                <Tooltip title="Read current parameters from the motor controller" placement="left">
                    <FloatButton
                        icon={<SyncOutlined />}
                        type="primary"
                        style={{ right: 94 }}
                        onClick={() => {
                        connection.loadData();
                        message.open({
                            key: 'loading',
                            type: 'loading',
                            content: i18n.t('loading'),
                        });
                        setTimeout(() => {
                            const { lastUpdateTime } = this.state;
                            if (Date.now() - lastUpdateTime < 3000) {
                                message.open({
                                    key: 'loading',
                                    type: 'success',
                                    content: i18n.t('loaded_successfully'),
                                    duration: 2,
                                });
                            } else {
                                message.open({
                                    key: 'loading',
                                    type: 'error',
                                    content: i18n.t('loading_error'),
                                    duration: 2,
                                });
                            }
                        }, 3000);
                    }}
                />
                </Tooltip>
                <Tooltip title="Write all current parameters to the motor controller" placement="left">
                    <Popconfirm
                        title={i18n.t('parameter_writing_title')}
                        description={i18n.t('parameter_writing_confirm')}
                        onConfirm={this.saveParameters}
                        okText={i18n.t('yes')}
                        cancelText={i18n.t('no')}
                    >
                        <FloatButton
                            icon={<DeliveredProcedureOutlined />}
                            type="primary"
                            style={{ right: 24 }}
                        />
                    </Popconfirm>
                </Tooltip>
            </div>
        );
    }
}

export default BafangUartMotorSettingsView;

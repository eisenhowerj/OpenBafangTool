import '@testing-library/jest-dom';
import { render, screen, act } from '@testing-library/react';
import App from '../ui/App';

// Mock the lazy-loaded components to avoid async issues in tests
jest.mock('../ui/views/DeviceSelectionView', () => {
    return function MockDeviceSelectionView() {
        return (
            <div data-testid="device-selection-view">Device Selection View</div>
        );
    };
});

jest.mock('../ui/views/MainView', () => {
    return function MockMainView() {
        return <div data-testid="main-view">Main View</div>;
    };
});

describe('App', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render without crashing', async () => {
        await act(async () => {
            render(<App />);
        });

        // The app should render successfully
        expect(screen.getByTestId('device-selection-view')).toBeInTheDocument();
    });

    it('should initially show the device selector view', async () => {
        await act(async () => {
            render(<App />);
        });

        // Check that the device selection view is rendered by default
        expect(screen.getByTestId('device-selection-view')).toBeInTheDocument();
        expect(screen.getByText('Device Selection View')).toBeInTheDocument();
    });

    it('should render the first page (device selection) correctly', async () => {
        await act(async () => {
            render(<App />);
        });

        // Verify that the initial state shows the device selector
        const deviceSelectionView = screen.getByTestId('device-selection-view');
        expect(deviceSelectionView).toBeInTheDocument();
        expect(deviceSelectionView).toBeVisible();
    });

    it('should have correct initial state', () => {
        const app = new App({});

        expect(app.state.view).toBe('device_selector');
        expect(app.state.connection).toBe(null);
        expect(app.state.interfaceType).toBe(null);
    });
});

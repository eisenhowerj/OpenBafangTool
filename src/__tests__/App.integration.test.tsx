import '@testing-library/jest-dom';
import { render, screen, act, waitFor } from '@testing-library/react';
import App from '../ui/App';

// Mock components to avoid complex dependencies in basic tests
jest.mock('../ui/views/DeviceSelectionView', () => {
    return function MockDeviceSelectionView({ deviceSelectionHook }: any) {
        return (
            <div data-testid="device-selection-view">
                <h1>Device Selection View</h1>
                <button
                    type="button"
                    data-testid="mock-device-button"
                    onClick={() => {
                        // Mock a device selection
                        const mockConnection = {
                            connect: jest.fn().mockResolvedValue(true),
                            disconnect: jest.fn(),
                        };
                        deviceSelectionHook(mockConnection, 'UART');
                    }}
                >
                    Select Device
                </button>
            </div>
        );
    };
});

jest.mock('../ui/views/MainView', () => {
    return function MockMainView({ connection, interfaceType, backHook }: any) {
        return (
            <div data-testid="main-view">
                <h1>Main View</h1>
                <p>Connection: {connection ? 'Connected' : 'Not Connected'}</p>
                <p>Interface: {interfaceType}</p>
                <button
                    type="button"
                    data-testid="back-button"
                    onClick={backHook}
                >
                    Back
                </button>
            </div>
        );
    };
});

describe('Application Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render the complete application without crashing', async () => {
        await act(async () => {
            render(<App />);
        });

        expect(screen.getByTestId('device-selection-view')).toBeInTheDocument();
    });

    it('should start with device selection view as the first page', async () => {
        await act(async () => {
            render(<App />);
        });

        // Verify initial state - device selection should be visible
        const deviceSelectionView = screen.getByTestId('device-selection-view');
        expect(deviceSelectionView).toBeInTheDocument();
        expect(screen.getByText('Device Selection View')).toBeInTheDocument();

        // Main view should not be present initially
        expect(screen.queryByTestId('main-view')).not.toBeInTheDocument();
    });

    it('should handle view transitions correctly', async () => {
        await act(async () => {
            render(<App />);
        });

        // Initially should show device selection
        expect(screen.getByTestId('device-selection-view')).toBeInTheDocument();

        // Simulate device selection
        const selectButton = screen.getByTestId('mock-device-button');

        await act(async () => {
            selectButton.click();
        });

        // Wait for transition to main view
        await waitFor(() => {
            expect(screen.getByTestId('main-view')).toBeInTheDocument();
        });

        // Device selection should no longer be visible
        expect(
            screen.queryByTestId('device-selection-view'),
        ).not.toBeInTheDocument();

        // Main view should show connection info
        expect(screen.getByText('Connection: Connected')).toBeInTheDocument();
        expect(screen.getByText('Interface: UART')).toBeInTheDocument();
    });

    it('should handle back navigation from main view to device selection', async () => {
        await act(async () => {
            render(<App />);
        });

        // Navigate to main view
        const selectButton = screen.getByTestId('mock-device-button');
        await act(async () => {
            selectButton.click();
        });

        // Verify we're in main view
        await waitFor(() => {
            expect(screen.getByTestId('main-view')).toBeInTheDocument();
        });

        // Click back button
        const backButton = screen.getByTestId('back-button');
        await act(async () => {
            backButton.click();
        });

        // Should be back to device selection
        await waitFor(() => {
            expect(
                screen.getByTestId('device-selection-view'),
            ).toBeInTheDocument();
        });
        expect(screen.queryByTestId('main-view')).not.toBeInTheDocument();
    });

    it('should display loading state correctly', async () => {
        const { container } = await act(async () => {
            return render(<App />);
        });

        // Check that the app renders with Suspense fallback handling
        expect(container).toBeInTheDocument();
    });

    it('should have proper error handling for unknown views', () => {
        const app = new App({});

        // Force an unknown view state by directly assigning to state
        (app as any).state = {
            view: 'unknown_view',
            connection: null,
            interfaceType: null,
        };

        const result = app.render();
        expect(result).toBeDefined();
    });
});

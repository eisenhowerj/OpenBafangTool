import fs from 'fs';
import path from 'path';
import toml from '@iarna/toml';

export interface SettingsMetadata {
    name?: string;
    description?: string;
    version?: string;
    author?: string;
    created?: string;
}

export type SettingsObject = {
    metadata?: SettingsMetadata;
    [key: string]:
        | Record<string, number | string>
        | SettingsMetadata
        | undefined;
};

export function loadSettingsFile(filePath: string): SettingsObject {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Try TOML first
    try {
        const parsed = toml.parse(content) as SettingsObject;
        // Ensure metadata section exists even if empty
        if (!parsed.metadata) {
            parsed.metadata = {};
        }
        return parsed;
    } catch (e) {
        // Fallback: parse TXT format (no metadata support for TXT)
        return parseTxtSettings(content);
    }
}

export function saveSettingsFile(
    filePath: string,
    settings: SettingsObject,
): void {
    const tomlString = toml.stringify(settings as any);
    fs.writeFileSync(filePath, tomlString, 'utf-8');
}

function parseTxtSettings(content: string): SettingsObject {
    const lines = content.split(/\r?\n/);
    const result: SettingsObject = {};
    let currentSection = '';
    for (const line of lines) {
        if (line.trim().startsWith('[') && line.trim().endsWith(']')) {
            currentSection = line.trim().slice(1, -1);
            result[currentSection] = {};
        } else if (
            line.includes('=') &&
            currentSection &&
            result[currentSection]
        ) {
            const [key, value] = line.split('=', 2);
            const numValue = Number(value.trim());
            if (!isNaN(numValue)) {
                (result[currentSection] as Record<string, number>)[key.trim()] =
                    numValue;
            } else {
                console.warn(
                    `Invalid number for key "${key.trim()}" in section "[${currentSection}]": "${value.trim()}"`,
                );
            }
        }
    }
    return result;
}

export function listPresetFiles(presetsDir: string): string[] {
    try {
        return fs
            .readdirSync(presetsDir)
            .filter((f) => f.endsWith('.toml') || f.endsWith('.txt'))
            .map((f) => path.join(presetsDir, f));
    } catch (error) {
        console.warn('Cannot read preset directory:', presetsDir, error);
        return [];
    }
}

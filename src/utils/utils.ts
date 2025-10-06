export function intToByteArray(integer: number, bytes: number): number[] {
    const array: number[] = [];
    for (let i = 0; i < bytes; i++) {
        array.push(integer & 255);
        integer >>= 8;
    }
    return array;
}

export function charsToString(char_arr: number[]): string {
    return String.fromCharCode.apply(null, char_arr);
}

export function validateTime(
    hours: number,
    minutes: number,
    seconds: number,
): boolean {
    return (
        hours >= 0 &&
        hours <= 23 &&
        minutes >= 0 &&
        minutes <= 59 &&
        seconds >= 0 &&
        seconds <= 59
    );
}

export function updateField<T>(
    obj: T,
    field_name: string,
    field_value: any,
): T {
    obj[field_name] = field_value;
    return obj;
}

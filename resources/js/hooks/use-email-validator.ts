import { useState, useRef, useEffect, useCallback } from 'react';

export type EmailValidationStatus = 'idle' | 'checking' | 'valid' | 'invalid' | 'error';

export interface UseEmailValidatorOptions {
    initialEmail?: string;
    ignoreUserId?: number | string | null;
    endpoint?: string;
    debounceMs?: number;
}

export interface UseEmailValidatorReturn {
    status: EmailValidationStatus;
    message: string;
    isValid: boolean;
    isChecking: boolean;
    checkEmail: (email: string) => void;
    validateEmailAsync: (emailToCheck?: string) => Promise<boolean>;
    reset: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useEmailValidator({
    initialEmail = '',
    ignoreUserId = null,
    endpoint = '/api/users/check-email',
    debounceMs = 400,
}: UseEmailValidatorOptions = {}): UseEmailValidatorReturn {
    const [status, setStatus] = useState<EmailValidationStatus>('idle');
    const [message, setMessage] = useState<string>('');

    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const cacheRef = useRef<Map<string, { available: boolean; message: string }>>(new Map());
    const latestEmailRef = useRef<string>(initialEmail);
    const isMountedRef = useRef<boolean>(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const normalizeEmail = useCallback((email: string) => email.trim().toLowerCase(), []);

    const isInitialEmail = useCallback(
        (email: string) => {
            if (!ignoreUserId || !initialEmail) return false;
            return normalizeEmail(email) === normalizeEmail(initialEmail);
        },
        [ignoreUserId, initialEmail, normalizeEmail]
    );

    const performNetworkValidation = useCallback(
        async (rawEmail: string): Promise<{ available: boolean; message: string }> => {
            const normalized = normalizeEmail(rawEmail);

            // Abort previous in-flight request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            const controller = new AbortController();
            abortControllerRef.current = controller;

            const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
            const url = new URL(endpoint, baseUrl);
            url.searchParams.set('email', normalized);
            if (ignoreUserId) {
                url.searchParams.set('ignore_id', String(ignoreUserId));
            }

            try {
                const response = await fetch(url.toString(), {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    credentials: 'same-origin',
                    signal: controller.signal,
                });

                const data = await response.json();
                const result = {
                    available: Boolean(data.available),
                    message: data.message || (data.available ? 'Email address is available.' : 'This email address is already registered.'),
                };

                cacheRef.current.set(normalized, result);
                return result;
            } catch (err: any) {
                if (err.name === 'AbortError') {
                    throw err;
                }
                return {
                    available: false,
                    message: 'Unable to verify email availability right now. Please try again.',
                };
            }
        },
        [endpoint, ignoreUserId, normalizeEmail]
    );

    const checkEmail = useCallback(
        (email: string) => {
            latestEmailRef.current = email;

            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }

            const trimmed = email.trim();
            if (!trimmed) {
                setStatus('idle');
                setMessage('');
                return;
            }

            if (!EMAIL_REGEX.test(trimmed)) {
                setStatus('invalid');
                setMessage('Please enter a valid email address.');
                return;
            }

            if (isInitialEmail(trimmed)) {
                setStatus('valid');
                setMessage('');
                return;
            }

            const normalized = normalizeEmail(trimmed);
            if (cacheRef.current.has(normalized)) {
                const cached = cacheRef.current.get(normalized)!;
                setStatus(cached.available ? 'valid' : 'invalid');
                setMessage(cached.message);
                return;
            }

            setStatus('checking');
            setMessage('Checking availability...');

            debounceTimerRef.current = setTimeout(async () => {
                try {
                    const result = await performNetworkValidation(trimmed);
                    if (!isMountedRef.current || latestEmailRef.current !== email) return;

                    setStatus(result.available ? 'valid' : 'invalid');
                    setMessage(result.message);
                } catch (err: any) {
                    if (err.name !== 'AbortError' && isMountedRef.current) {
                        setStatus('error');
                        setMessage('Verification failed. Please check your connection.');
                    }
                }
            }, debounceMs);
        },
        [debounceMs, isInitialEmail, normalizeEmail, performNetworkValidation]
    );

    const validateEmailAsync = useCallback(
        async (emailToCheck?: string): Promise<boolean> => {
            const targetEmail = typeof emailToCheck === 'string' ? emailToCheck : latestEmailRef.current;
            latestEmailRef.current = targetEmail;

            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }

            const trimmed = targetEmail.trim();
            if (!trimmed) {
                setStatus('invalid');
                setMessage('Email address is required.');
                return false;
            }

            if (!EMAIL_REGEX.test(trimmed)) {
                setStatus('invalid');
                setMessage('Please enter a valid email address.');
                return false;
            }

            if (isInitialEmail(trimmed)) {
                setStatus('valid');
                setMessage('');
                return true;
            }

            const normalized = normalizeEmail(trimmed);
            if (cacheRef.current.has(normalized)) {
                const cached = cacheRef.current.get(normalized)!;
                setStatus(cached.available ? 'valid' : 'invalid');
                setMessage(cached.message);
                return cached.available;
            }

            setStatus('checking');
            setMessage('Checking availability...');

            try {
                const result = await performNetworkValidation(trimmed);
                if (isMountedRef.current) {
                    setStatus(result.available ? 'valid' : 'invalid');
                    setMessage(result.message);
                }
                return result.available;
            } catch (err: any) {
                if (err.name === 'AbortError') {
                    return false;
                }
                if (isMountedRef.current) {
                    setStatus('error');
                    setMessage('Verification failed. Please check your connection.');
                }
                return false;
            }
        },
        [isInitialEmail, normalizeEmail, performNetworkValidation]
    );

    const reset = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setStatus('idle');
        setMessage('');
    }, []);

    return {
        status,
        message,
        isValid: status === 'valid',
        isChecking: status === 'checking',
        checkEmail,
        validateEmailAsync,
        reset,
    };
}

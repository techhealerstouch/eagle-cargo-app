import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAutoSave } from '../use-auto-save';

describe('useAutoSave Hook', () => {
  const key = 'test_form';
  const initialData = { name: '', email: '' };

  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};

    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  })();

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  });

  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should save data to localStorage when it changes after debounce', () => {
    const setData = vi.fn();
    const { rerender } = renderHook(
      ({ data }) => useAutoSave(key, data, setData),
      {
        initialProps: { data: initialData }
      }
    );

    const newData = { name: 'John Doe', email: 'john@example.com' };

    // Update the hook with new data
    rerender({ data: newData });

    // Should not be saved immediately due to debounce
    expect(window.localStorage.getItem(`autosave_${key}`)).toBeNull();

    // Advance time by 1s
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const saved = JSON.parse(window.localStorage.getItem(`autosave_${key}`) || '{}');
    expect(saved).toEqual(newData);
  });

  it('should restore data from localStorage on mount', () => {
    const savedData = { name: 'Saved Name', email: 'saved@example.com' };
    window.localStorage.setItem(`autosave_${key}`, JSON.stringify(savedData));

    const setData = vi.fn();

    renderHook(() => useAutoSave(key, initialData, setData));

    // Wait for the effect to run
    // Since we're using a functional update or object merge in the hook:
    // setData(current => ({ ...current, ...parsedData }))
    expect(setData).toHaveBeenCalled();

    // Check if the callback passed to setData correctly merges data
    const updateFn = setData.mock.calls[0][0];

    if (typeof updateFn === 'function') {
      const result = updateFn(initialData);
      expect(result).toEqual(savedData);
    } else {
      // In case the hook uses direct object
      expect(updateFn).toEqual(expect.objectContaining(savedData));
    }
  });

  it('should not restore or save if isEnabled is false', () => {
    const savedData = { name: 'Invisible', email: 'no@save.com' };
    window.localStorage.setItem(`autosave_${key}`, JSON.stringify(savedData));

    const setData = vi.fn();
    const { rerender } = renderHook(
      ({ isEnabled, data }) => useAutoSave(key, data, setData, isEnabled),
      {
        initialProps: { isEnabled: false, data: initialData },
      },
    );

    // Initial check: setData should NOT be called on mount if disabled
    expect(setData).not.toHaveBeenCalled();

    // Update check: localStorage should NOT change if disabled
    rerender({ isEnabled: false, data: { name: 'New but disabled', email: '' } });
    const localContent = window.localStorage.getItem(`autosave_${key}`);
    expect(JSON.parse(localContent || '{}')).toEqual(savedData); // still original saved data
  });

  it('should clear data when clearSavedData is called', () => {
    window.localStorage.setItem(`autosave_${key}`, JSON.stringify({ test: 'data' }));

    const { result } = renderHook(() => useAutoSave(key, initialData, vi.fn()));

    act(() => {
      result.current.clearSavedData();
    });

    expect(window.localStorage.getItem(`autosave_${key}`)).toBeNull();
  });
});

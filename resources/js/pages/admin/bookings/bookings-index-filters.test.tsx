import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const routerGetMock = vi.fn();

vi.mock('@inertiajs/react', () => ({
    Head: ({ title }: { title: string }) => <title>{title}</title>,
    Link: ({ href, children, preserveState: _ps, preserveScroll: _psc, ...props }: any) => (
        <a href={href} {...props}>{children}</a>
    ),
    router: {
        get: (...args: any[]) => routerGetMock(...args),
        post: vi.fn(),
        delete: vi.fn(),
        reload: vi.fn(),
    },
    useForm: () => ({ post: vi.fn(), processing: false, data: { picker_id: '', courier_id: '' }, setData: vi.fn() }),
    usePage: () => ({
        props: {
            flash: {},
            auth: { user: { id: 1, name: 'Super Admin', role: 'super_admin' } },
            tracking_steps: [],
        },
    }),
}));

vi.mock('@/layouts/app-layout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

import BookingsIndex from '@/pages/admin/bookings/index';

describe('BookingsIndex filters and defensive rendering', () => {
    beforeEach(() => {
        routerGetMock.mockClear();
    });

    const basePagination: any = {
        data: [
            {
                id: 99,
                reference_number: 'BK-DEL-SENDER',
                sender_id: 50,
                sender: null,
                status: 'pending',
                booking_type: 'home_pickup',
                payment_status: 'pending',
                service_type: 'door_to_door',
                destination: 'Metro Manila',
                preferred_date: null,
                declaration_form_status: 'missing',
                box_count: 1,
                created_at: new Date().toISOString(),
            },
        ],
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 1,
        links: [],
    };

    it('normalizes PHP empty array filters, resets page on tab/select clicks, and renders null sender safely', () => {
        render(
            <BookingsIndex
                bookings={basePagination}
                pickers={[]}
                couriers={[]}
                activeRunsheets={[]}
                filters={[] as any}
            />
        );

        expect(screen.getByText('Deleted Sender')).toBeTruthy();

        const tabExpectations: [string, Record<string, any>][] = [
            ['Pending', { status: 'pending', page: 1 }],
            ['Confirmed', { status: 'confirmed', page: 1 }],
            ['Collected', { status: 'collected', page: 1 }],
            ['Shipped', { status: 'shipped', page: 1 }],
            ['Delivered', { status: 'delivered', page: 1 }],
            ['Cancelled', { status: 'cancelled', page: 1 }],
            ['Archived', { trashed: true, page: 1 }],
        ];

        for (const [label, expectedParams] of tabExpectations) {
            routerGetMock.mockClear();
            const tab = screen.getByRole('tab', { name: new RegExp(label, 'i') });
            fireEvent.mouseDown(tab, { button: 0 });
            fireEvent.click(tab);
            expect(routerGetMock).toHaveBeenCalledWith(
                '/admin/bookings',
                expectedParams,
                { preserveState: true, replace: true }
            );
        }

        const selectCases: [string, string, Record<string, any>][] = [
            ['Payment', 'Paid', { payment_status: 'paid', page: 1 }],
            ['Declaration', 'Missing', { declaration_form_status: 'missing', page: 1 }],
            ['Customer', 'Guest Bookings', { customer_type: 'guest', page: 1 }],
        ];

        for (const [ariaLabel, optionLabel, expectedParams] of selectCases) {
            routerGetMock.mockClear();
            const trigger = screen.getByLabelText(ariaLabel);
            fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
            fireEvent.click(trigger);
            fireEvent.click(screen.getByRole('option', { name: optionLabel }));
            expect(routerGetMock).toHaveBeenCalledWith(
                '/admin/bookings',
                expectedParams,
                { preserveState: true, replace: true }
            );
        }
    });

    it('preserves dropdown filters when toggling status tabs or Archived and clears status cleanly on All', () => {
        render(
            <BookingsIndex
                bookings={basePagination}
                pickers={[]}
                couriers={[]}
                activeRunsheets={[]}
                filters={{ status: 'pending', payment_status: 'paid' }}
            />
        );

        const archivedTab = screen.getByRole('tab', { name: /Archived/i });
        fireEvent.mouseDown(archivedTab, { button: 0 });
        fireEvent.click(archivedTab);
        expect(routerGetMock).toHaveBeenLastCalledWith(
            '/admin/bookings',
            { payment_status: 'paid', trashed: true, page: 1 },
            { preserveState: true, replace: true }
        );

        const allTab = screen.getByRole('tab', { name: /^All$/i });
        fireEvent.mouseDown(allTab, { button: 0 });
        fireEvent.click(allTab);
        expect(routerGetMock).toHaveBeenLastCalledWith(
            '/admin/bookings',
            { payment_status: 'paid', page: 1 },
            { preserveState: true, replace: true }
        );
    });
});

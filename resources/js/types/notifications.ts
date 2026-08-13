export type Notification = {
    id: string;
    type: string;
    data: {
        type?: string;
        message?: string;
        title?: string;
        tracking_number?: string;
        status?: string;
        status_label?: string;
        url?: string;
        box_id?: number;
        batch_id?: number;
        [key: string]: unknown;
    };
    read_at: string | null;
    created_at: string;
};

export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';

export type NotificationPreference = {
    channel: NotificationChannel;
    event_type: string;
    enabled: boolean;
};

export type NotificationPreferenceMatrix = {
    [eventType: string]: {
        label: string;
        category: string;
        channels: {
            [channel in NotificationChannel]: boolean;
        };
    };
};

export type ChannelInfo = {
    value: NotificationChannel;
    label: string;
};

export type NotificationsResponse = {
    success: boolean;
    data: {
        notifications: Notification[];
        unread_count: number;
        pagination: {
            current_page: number;
            last_page: number;
            per_page: number;
            total: number;
        };
    };
};

export type UnreadCountResponse = {
    success: boolean;
    data: {
        count: number;
    };
};

export type PreferencesResponse = {
    success: boolean;
    data: {
        preferences: NotificationPreferenceMatrix;
        channels: ChannelInfo[];
        categories: {
            [key: string]: string;
        };
    };
};

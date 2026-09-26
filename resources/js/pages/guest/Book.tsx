import React from 'react';
import SenderBook from '@/pages/sender/Book';

interface GuestBookProps {
    areas?: any[];
    provinces?: any[];
    boxTypes?: any[];
    boxPrices?: any[];
    pickupZones?: any[];
    suburbs?: any[];
    logistics?: any;
    [key: string]: any;
}

export default function GuestBook(props: GuestBookProps) {
    return <SenderBook isGuest={true} {...props} />;
}

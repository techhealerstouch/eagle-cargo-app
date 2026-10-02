import React from 'react';
import SenderBook from '@/pages/sender/Book';

export default function GuestBook(props: any) {
    return <SenderBook {...props} isGuest={true} />;
}

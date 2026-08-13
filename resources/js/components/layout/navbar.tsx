import { Link } from '@inertiajs/react';
import { Menu, Download } from 'lucide-react';
import { useState } from 'react';
import DeclarationDownloadModal from '@/components/common/declaration-download-modal';
import AppLogo from '@/components/layout/app-logo';
import { Button } from '@/components/ui/button';
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuList,
    navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn } from '@/lib/utils';

const navLinks = [
    { name: 'Home', href: '/home' },
    { name: 'About', href: '/about' },
    { name: 'Services', href: '/services' },
    { name: 'FAQ', href: '/faq' },
    { name: 'Contact', href: '/contact' },
];

export function Navbar() {
    const { isCurrentUrl, whenCurrentUrl } = useCurrentUrl();
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const activeItemStyles =
        'text-brand-primary dark:text-brand-primary font-bold bg-transparent';
    const inactiveItemStyles =
        'text-brand-text-mid hover:text-brand-primary dark:text-neutral-400 dark:hover:text-brand-primary font-semibold bg-transparent';

    return (
        <header className="fixed top-0 z-40 w-full border-b border-brand-sand bg-brand-cream/90 backdrop-blur-md transition-all">
            <div className="container-default px-4 sm:px-6 lg:px-8">
                <div className="flex h-20 items-center justify-between">
                    <div className="flex items-center">
                        <Link
                            href="/home"
                            className="group flex items-center gap-2"
                        >
                            <AppLogo />
                        </Link>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden flex-1 justify-center md:flex">
                        <NavigationMenu>
                            <NavigationMenuList className="space-x-2">
                                {navLinks.map((link) => (
                                    <NavigationMenuItem key={link.name}>
                                        <Link
                                            href={link.href}
                                            className={cn(
                                                navigationMenuTriggerStyle(),
                                                isCurrentUrl(link.href)
                                                    ? activeItemStyles
                                                    : inactiveItemStyles,
                                                'text-sm tracking-wide transition-colors hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent',
                                            )}
                                        >
                                            {link.name}
                                        </Link>
                                    </NavigationMenuItem>
                                ))}
                            </NavigationMenuList>
                        </NavigationMenu>
                    </nav>

                    <div className="hidden items-center md:flex gap-4">
                        <a
                            href="/declaration-form/blank"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                                e.preventDefault();
                                setIsConfirmOpen(true);
                            }}
                        >
                            <Button variant="outline" className="rounded-md border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white transition-colors px-6 py-2.5 font-semibold gap-2">
                                <Download className="size-4" />
                                Declaration Form
                            </Button>
                        </a>
                        <Link href="/book">
                            <Button className="btn-primary rounded-md bg-brand-primary px-6 py-2.5 text-white hover:bg-brand-primary-dark">
                                Book Pickup
                            </Button>
                        </Link>
                    </div>

                    {/* Mobile Menu */}
                    <div className="flex items-center md:hidden">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="p-2 text-brand-text transition hover:bg-transparent hover:text-brand-primary"
                                >
                                    <Menu className="size-6" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent
                                side="left"
                                className="flex w-full flex-col border-r-brand-sand bg-brand-cream p-6 pt-10 sm:w-80"
                            >
                                <SheetHeader className="mb-8">
                                    <SheetTitle className="sr-only">
                                        Navigation menu
                                    </SheetTitle>
                                    <Link
                                        href="/home"
                                        className="group flex items-center justify-start gap-2"
                                    >
                                        <AppLogo />
                                    </Link>
                                </SheetHeader>
                                <div className="flex flex-1 flex-col space-y-6">
                                    {navLinks.map((link) => (
                                        <Link
                                            key={link.name}
                                            href={link.href}
                                            className={cn(
                                                'text-lg font-medium transition-colors hover:text-brand-primary',
                                                isCurrentUrl(link.href)
                                                    ? 'font-bold text-brand-primary'
                                                    : 'text-brand-text',
                                            )}
                                        >
                                            {link.name}
                                        </Link>
                                    ))}
                                </div>
                                <div className="mt-auto border-t border-brand-sand pt-6 space-y-3">
                                    <a
                                        href="/declaration-form/blank"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block w-full"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setIsConfirmOpen(true);
                                        }}
                                    >
                                        <Button variant="outline" className="w-full border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white transition-colors gap-2">
                                            <Download className="size-4" />
                                            Declaration Form
                                        </Button>
                                    </a>
                                    <Link href="/book" className="block w-full">
                                        <Button className="btn-primary w-full bg-brand-primary text-white hover:bg-brand-primary-dark">
                                            Book a Box
                                        </Button>
                                    </Link>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </div>
            <DeclarationDownloadModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
            />
        </header>
    );
}






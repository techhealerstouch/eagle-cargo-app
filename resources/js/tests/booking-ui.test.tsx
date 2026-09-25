import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GuestBook from '@/pages/guest/Book';
import SenderBook from '@/pages/sender/Book';

// Mock Tooltip to prevent TooltipProvider requirement in isolation
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <>{children}</>,
  TooltipProvider: ({ children }: any) => <>{children}</>,
}));

// Mock LocationPickerMap (Leaflet uses canvas/webgl not supported in jsdom)
vi.mock('@/components/ui/LocationPickerMap', () => ({
  default: () => <div data-testid="mock-location-picker-map">Mock Map</div>,
}));

// Mock Stripe components
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: any) => <div data-testid="stripe-elements">{children}</div>,
  PaymentElement: () => <div data-testid="stripe-payment-element">Stripe Card Input</div>,
  useStripe: () => ({ confirmPayment: vi.fn() }),
  useElements: () => ({ getElement: vi.fn() }),
}));

// Mock Sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockAreas = [
  { id: 1, name: 'Metro Manila', door_to_door_fee: '15.00' },
  { id: 2, name: 'Luzon', door_to_door_fee: '20.00' },
];

const mockProvinces = [
  { id: 1, name: 'Metro Manila', area_id: 1 },
  { id: 2, name: 'Batangas', area_id: 2 },
];

const mockBoxTypes = [
  { id: 1, name: 'Jumbo', dimensions: '24x24x24' },
  { id: 2, name: 'Medium', dimensions: '20x20x20' },
  { id: 3, name: 'Custom Box (CBM)' },
];

const mockPickupZones = [
  {
    id: 1,
    name: 'Sydney Metro',
    suburbs: ['Blacktown', 'Sydney', 'Parramatta'],
    lead_time_days: 2,
    pickup_windows: [],
    blackout_dates: [],
  },
];

const mockBoxPrices = [
  { id: 1, area_id: 1, box_type_id: 1, pickup_zone_id: 1, price: '120.00' },
  { id: 2, area_id: 1, box_type_id: 2, pickup_zone_id: 1, price: '95.00' },
  { id: 3, area_id: 1, box_type_id: 3, pickup_zone_id: 1, price: '450.00' },
];

const mockSuburbs = [
  { id: 1, name: 'Blacktown', postcode: '2148', state: 'NSW', pickup_zone_id: 1 },
  { id: 2, name: 'Sydney', postcode: '2000', state: 'NSW', pickup_zone_id: 1 },
];

const mockLogistics = {
  leadTimeDays: 2,
  pickupWindows: [],
  blackoutDates: [],
};

const mockSenderUser = {
  id: 1,
  name: 'Juan Dela Cruz',
  email: 'juan.sender@example.com',
  role: 'sender',
};

const mockSenderProfile = {
  id: 1,
  user_id: 1,
  first_name: 'Juan',
  last_name: 'Dela Cruz',
  email: 'juan.sender@example.com',
  mobile: '0412345678',
  address: '123 George St',
  suburb: 'Sydney',
  state: 'NSW',
  postcode: '2000',
  pickup_zone_id: 1,
  country: 'Australia',
};

const mockSavedRecipients = [
  {
    id: 1,
    first_name: 'Maria',
    last_name: 'Clara',
    phone_number: '+639171234567',
    address: '456 Rizal St',
    city: 'Manila',
    province: 'Metro Manila',
    zip_code: '1000',
    area_id: 1,
  },
];

const mockInitResponse = {
  booking: {
    id: 99,
    reference_number: 'BK-2026-TEST-01',
    status: 'pending',
    boxes: [
      {
        id: 1,
        box_type_id: 1,
        price_charged: '120.00',
        price_is_estimate: false,
        is_custom_size: false,
        box_type: { name: 'Jumbo' },
        recipient: { first_name: 'Juan', last_name: 'Dela Cruz', city: 'Manila', province: 'Metro Manila' },
      },
    ],
    payment_method: 'bank_transfer',
    payment_status: 'pending',
  },
  guest_token: 'valid-test-token-123',
  bankDetails: {
    bank_name: 'Commonwealth Bank',
    bsb: '064-449',
    account_number: '1097 5991',
    company_name: 'Eagle Cargo',
  },
};

// Mock Inertia usePage
vi.mock('@inertiajs/react', async () => {
  const actual = await vi.importActual<any>('@inertiajs/react');
  return {
    ...actual,
    usePage: () => ({
      props: {
        auth: {
          user: mockSenderUser,
        },
        logistics: mockLogistics,
        areas: mockAreas,
        provinces: mockProvinces,
        boxTypes: mockBoxTypes,
        boxPrices: mockBoxPrices,
        pickupZones: mockPickupZones,
        suburbs: mockSuburbs,
        sender: mockSenderProfile,
        savedRecipients: mockSavedRecipients,
      },
    }),
    Head: ({ children }: any) => <>{children}</>,
    Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  };
});

describe('Guest Booking UI (/guest/book)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockInitResponse),
      })
    );
  });

  it('renders StepIndicator with all 4 steps', () => {
    render(
      <GuestBook
        areas={mockAreas}
        provinces={mockProvinces}
        boxTypes={mockBoxTypes}
        boxPrices={mockBoxPrices}
        pickupZones={mockPickupZones}
        suburbs={mockSuburbs}
      />
    );

    expect(screen.getByText('Sender & Pickup')).toBeInTheDocument();
    expect(screen.getByText('Boxes & Recipients')).toBeInTheDocument();
    expect(screen.getByText('Review Details')).toBeInTheDocument();
    expect(screen.getByText('Payment & Confirmation')).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
  });

  it('renders Step 1 contact and pickup form fields', () => {
    render(
      <GuestBook
        areas={mockAreas}
        provinces={mockProvinces}
        boxTypes={mockBoxTypes}
        boxPrices={mockBoxPrices}
        pickupZones={mockPickupZones}
        suburbs={mockSuburbs}
      />
    );

    expect(screen.getByPlaceholderText(/e\.g\. Maria/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. Santos/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. Unit 4, 123 George Street/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. 2000/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Continue$/i })).toBeInTheDocument();
  });

  it('validates required fields on Step 1 and displays error messages', async () => {
    render(
      <GuestBook
        areas={mockAreas}
        provinces={mockProvinces}
        boxTypes={mockBoxTypes}
        boxPrices={mockBoxPrices}
        pickupZones={mockPickupZones}
        suburbs={mockSuburbs}
      />
    );

    const nextBtn = screen.getByRole('button', { name: /^Continue$/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/First Name is required/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Last Name is required/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Email Address is required/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Contact Phone is required/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Pickup Address is required/i).length).toBeGreaterThan(0);
    });
  });

  it('advances from Step 1 to Step 2 when sender details are filled', async () => {
    render(
      <GuestBook
        areas={mockAreas}
        provinces={mockProvinces}
        boxTypes={mockBoxTypes}
        boxPrices={mockBoxPrices}
        pickupZones={mockPickupZones}
        suburbs={mockSuburbs}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Maria/i), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Santos/i), { target: { value: 'Santos' } });
    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'maria@example.com' } });
    
    const phoneInputs = screen.getAllByRole('textbox');
    const mobileInput = phoneInputs.find(i => i.getAttribute('type') === 'tel') || phoneInputs[0];
    fireEvent.change(mobileInput, { target: { value: '0412345678' } });

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Unit 4, 123 George Street/i), { target: { value: '123 Test St' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 2000/i), { target: { value: '2148' } });
    
    const suburbInput = screen.getByPlaceholderText(/Type suburb or postcode\.\.\./i);
    fireEvent.change(suburbInput, { target: { value: 'Blacktown' } });

    const nextBtn = screen.getByRole('button', { name: /^Continue$/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText(/Primary Recipient/i)).toBeInTheDocument();
      expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument();
    });
  });

  it('renders box selection and supports adding multiple boxes on Step 2', async () => {
    render(
      <GuestBook
        areas={mockAreas}
        provinces={mockProvinces}
        boxTypes={mockBoxTypes}
        boxPrices={mockBoxPrices}
        pickupZones={mockPickupZones}
        suburbs={mockSuburbs}
      />
    );

    // Fast-fill Step 1
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Maria/i), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Santos/i), { target: { value: 'Santos' } });
    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'maria@example.com' } });
    const phoneInputs = screen.getAllByRole('textbox');
    const mobileInput = phoneInputs.find(i => i.getAttribute('type') === 'tel') || phoneInputs[0];
    fireEvent.change(mobileInput, { target: { value: '0412345678' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Unit 4, 123 George Street/i), { target: { value: '123 Test St' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 2000/i), { target: { value: '2148' } });
    fireEvent.change(screen.getByPlaceholderText(/Type suburb or postcode\.\.\./i), { target: { value: 'Blacktown' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Primary Recipient/i)).toBeInTheDocument();
    });

    const addBoxBtn = screen.getByRole('button', { name: /Add Another Box/i });
    expect(addBoxBtn).toBeInTheDocument();

    fireEvent.click(addBoxBtn);

    await waitFor(() => {
      expect(screen.getByText(/Unit 02/i)).toBeInTheDocument();
    });
  });

  it('advances from Step 2 to Step 3 Review Details and displays order breakdown', async () => {
    render(
      <GuestBook
        areas={mockAreas}
        provinces={mockProvinces}
        boxTypes={mockBoxTypes}
        boxPrices={mockBoxPrices}
        pickupZones={mockPickupZones}
        suburbs={mockSuburbs}
      />
    );

    // Fill Step 1
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Maria/i), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Santos/i), { target: { value: 'Santos' } });
    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'maria@example.com' } });
    const phoneInputs = screen.getAllByRole('textbox');
    const mobileInput = phoneInputs.find(i => i.getAttribute('type') === 'tel') || phoneInputs[0];
    fireEvent.change(mobileInput, { target: { value: '0412345678' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Unit 4, 123 George Street/i), { target: { value: '123 Test St' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 2000/i), { target: { value: '2148' } });
    fireEvent.change(screen.getByPlaceholderText(/Type suburb or postcode\.\.\./i), { target: { value: 'Blacktown' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Primary Recipient/i)).toBeInTheDocument();
    });

    // Fill Step 2 Recipient
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Juan/i), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Dela Cruz/i), { target: { value: 'Dela Cruz' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Block 5 Lot 12/i), { target: { value: 'Block 1 Lot 2 Sampaguita St' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Pasig City/i), { target: { value: 'Manila' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 1600/i), { target: { value: '1000' } });
    fireEvent.change(screen.getByPlaceholderText(/recipient@example\.com/i), { target: { value: 'juan@example.com' } });
    fireEvent.change(screen.getAllByPlaceholderText(/09XX/i)[0], { target: { value: '09171234567' } });

    // Select Province (auto-resolves area_id)
    const provinceSelect = screen.getByRole('combobox', { name: /Province/i });
    fireEvent.change(provinceSelect, { target: { value: 'Metro Manila' } });

    // Select Box Type via Button
    const jumboBtn = screen.getByRole('button', { name: /JUMBO/i });
    fireEvent.click(jumboBtn);

    const reviewBtn = screen.getByRole('button', { name: /Review Details/i });
    fireEvent.click(reviewBtn);

    await waitFor(() => {
      expect(screen.getByText(/Step 3 of 4/i)).toBeInTheDocument();
      expect(screen.getByText(/Review Booking Details/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Proceed to Payment/i })).toBeInTheDocument();
    });
  });

  it('proceeds from Step 3 to Step 4 Live Payment Console with Bank Details', async () => {
    render(
      <GuestBook
        areas={mockAreas}
        provinces={mockProvinces}
        boxTypes={mockBoxTypes}
        boxPrices={mockBoxPrices}
        pickupZones={mockPickupZones}
        suburbs={mockSuburbs}
      />
    );

    // Fast Step 1
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Maria/i), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Santos/i), { target: { value: 'Santos' } });
    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'maria@example.com' } });
    const phoneInputs = screen.getAllByRole('textbox');
    const mobileInput = phoneInputs.find(i => i.getAttribute('type') === 'tel') || phoneInputs[0];
    fireEvent.change(mobileInput, { target: { value: '0412345678' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Unit 4, 123 George Street/i), { target: { value: '123 Test St' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 2000/i), { target: { value: '2148' } });
    fireEvent.change(screen.getByPlaceholderText(/Type suburb or postcode\.\.\./i), { target: { value: 'Blacktown' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Primary Recipient/i)).toBeInTheDocument();
    });

    // Fast Step 2
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Juan/i), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Dela Cruz/i), { target: { value: 'Dela Cruz' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Block 5 Lot 12/i), { target: { value: 'Block 1 Lot 2 Sampaguita St' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Pasig City/i), { target: { value: 'Manila' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 1600/i), { target: { value: '1000' } });
    fireEvent.change(screen.getByPlaceholderText(/recipient@example\.com/i), { target: { value: 'juan@example.com' } });
    fireEvent.change(screen.getAllByPlaceholderText(/09XX/i)[0], { target: { value: '09171234567' } });

    const provinceSelect = screen.getByRole('combobox', { name: /Province/i });
    fireEvent.change(provinceSelect, { target: { value: 'Metro Manila' } });

    const jumboBtn = screen.getByRole('button', { name: /JUMBO/i });
    fireEvent.click(jumboBtn);

    fireEvent.click(screen.getByRole('button', { name: /Review Details/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Proceed to Payment/i })).toBeInTheDocument();
    });

    // Proceed to Step 4
    const proceedBtn = screen.getByRole('button', { name: /Proceed to Payment/i });
    fireEvent.click(proceedBtn);

    await waitFor(() => {
      expect(screen.getByText(/Step 4 of 4/i)).toBeInTheDocument();
      expect(screen.getByText(/Commonwealth Bank/i)).toBeInTheDocument();
      expect(screen.getByText(/064-449/i)).toBeInTheDocument();
    });
  });

  it('allows selecting Door-to-Door Add-On and Empty Box Delivery on Step 2', async () => {
    render(
      <GuestBook
        areas={mockAreas}
        provinces={mockProvinces}
        boxTypes={mockBoxTypes}
        boxPrices={mockBoxPrices}
        pickupZones={mockPickupZones}
        suburbs={mockSuburbs}
      />
    );

    // Fast Step 1
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Maria/i), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Santos/i), { target: { value: 'Santos' } });
    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'maria@example.com' } });
    const phoneInputs = screen.getAllByRole('textbox');
    const mobileInput = phoneInputs.find(i => i.getAttribute('type') === 'tel') || phoneInputs[0];
    fireEvent.change(mobileInput, { target: { value: '0412345678' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Unit 4, 123 George Street/i), { target: { value: '123 Test St' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 2000/i), { target: { value: '2148' } });
    fireEvent.change(screen.getByPlaceholderText(/Type suburb or postcode\.\.\./i), { target: { value: 'Blacktown' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Primary Recipient/i)).toBeInTheDocument();
    });

    // Check Door-to-Door Delivery Add-On is visible on Step 2
    expect(screen.getByText(/Door-to-Door Delivery Add-On/i)).toBeInTheDocument();

    // Check Empty Box Delivery Service is visible on Step 2
    expect(screen.getByText(/Empty Box Delivery Service/i)).toBeInTheDocument();
    const emptyBoxCheckbox = screen.getByLabelText(/I need empty boxes delivered to my address before pickup/i);
    expect(emptyBoxCheckbox).toBeInTheDocument();
    expect(emptyBoxCheckbox).not.toBeChecked();

    // Toggle Empty Box Delivery
    fireEvent.click(emptyBoxCheckbox);
    expect(screen.getByText(/Empty Box Quantity/i)).toBeInTheDocument();
  });
});

describe('Sender Booking UI (/book)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockInitResponse),
      })
    );
  });

  it('renders StepIndicator with all 4 steps for authenticated Sender', () => {
    render(<SenderBook />);

    expect(screen.getByText('Sender & Pickup')).toBeInTheDocument();
    expect(screen.getByText('Boxes & Recipients')).toBeInTheDocument();
    expect(screen.getByText('Review Details')).toBeInTheDocument();
    expect(screen.getByText('Payment & Confirmation')).toBeInTheDocument();
  });

  it('displays pre-filled sender profile as a read-only summary (not editable form)', () => {
    render(<SenderBook />);

    // Sender profile is shown as locked read-only text, not input fields
    expect(screen.getAllByText(/Juan Dela Cruz/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/123 George St/i)).toBeInTheDocument();

    // There should be NO editable first/last name placeholders like the guest flow
    expect(screen.queryByPlaceholderText(/e\.g\. Maria/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/e\.g\. Santos/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/you@example\.com/i)).not.toBeInTheDocument();
  });

  it('renders Step 1 "Continue" button (not "Continue to Boxes & Recipients") and advances to Step 2', async () => {
    render(<SenderBook />);

    // Sender uses a short "Continue" label, not "Continue to Boxes & Recipients"
    const continueBtn = screen.getByRole('button', { name: /^Continue$/i });
    expect(continueBtn).toBeInTheDocument();
    expect(continueBtn).not.toBeDisabled();

    // Guest-style label should NOT be present
    expect(screen.queryByRole('button', { name: /Continue to Boxes & Recipients/i })).not.toBeInTheDocument();

    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(screen.getByText(/Primary Recipient/i)).toBeInTheDocument();
      expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument();
    });
  });

  it('allows selecting saved recipients on Step 2 (sender-only feature)', async () => {
    render(<SenderBook />);

    // Advance to Step 2
    fireEvent.click(screen.getByRole('button', { name: /^Continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Primary Recipient/i)).toBeInTheDocument();
    });

    // Saved recipients dropdown is a sender-only feature (not available for guests)
    expect(screen.getByLabelText(/Select Saved Contact/i)).toBeInTheDocument();
  });

  it('uses button-grid for box type selection (not dropdown like guest)', async () => {
    render(<SenderBook />);

    fireEvent.click(screen.getByRole('button', { name: /^Continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Primary Recipient/i)).toBeInTheDocument();
    });

    // Sender uses clickable box type buttons (visual cards), not <select> dropdowns
    const jumboBtn = screen.getByRole('button', { name: /JUMBO/i });
    expect(jumboBtn).toBeInTheDocument();
  });

  it('advances from Step 2 to Step 3 using "Review Details" button (not "Continue to Review")', async () => {
    render(<SenderBook />);

    fireEvent.click(screen.getByRole('button', { name: /^Continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Primary Recipient/i)).toBeInTheDocument();
    });

    // Select Saved Recipient
    const savedRecSelect = screen.getByLabelText(/Select Saved Contact/i);
    fireEvent.change(savedRecSelect, { target: { value: '1' } });

    // Select Box Type via button (not dropdown)
    const jumboBtn = screen.getByRole('button', { name: /JUMBO/i });
    fireEvent.click(jumboBtn);

    // Sender uses "Review Details" — guest uses "Continue to Review"
    const reviewBtn = screen.getByRole('button', { name: /Review Details/i });
    expect(reviewBtn).toBeInTheDocument();

    // "Continue to Review" (guest-style) should NOT be present
    expect(screen.queryByRole('button', { name: /Continue to Review/i })).not.toBeInTheDocument();

    fireEvent.click(reviewBtn);

    await waitFor(() => {
      expect(screen.getByText(/Step 3 of 4/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Proceed to Payment/i })).toBeInTheDocument();
    });
  });

  it('proceeds from Step 3 to Step 4 Live Payment Console for authenticated Sender', async () => {
    render(<SenderBook />);

    fireEvent.click(screen.getByRole('button', { name: /^Continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Primary Recipient/i)).toBeInTheDocument();
    });

    // Select Saved Recipient
    const savedRecSelect = screen.getByLabelText(/Select Saved Contact/i);
    fireEvent.change(savedRecSelect, { target: { value: '1' } });

    // Select Box Type via button
    const jumboBtn = screen.getByRole('button', { name: /JUMBO/i });
    fireEvent.click(jumboBtn);

    // Step 2 -> Step 3 via "Review Details"
    fireEvent.click(screen.getByRole('button', { name: /Review Details/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Proceed to Payment/i })).toBeInTheDocument();
    });

    // Step 3 -> Step 4
    fireEvent.click(screen.getByRole('button', { name: /Proceed to Payment/i }));

    await waitFor(() => {
      expect(screen.getByText(/Step 4 of 4/i)).toBeInTheDocument();
      expect(screen.getByText(/Commonwealth Bank/i)).toBeInTheDocument();
      expect(screen.getByText(/064-449/i)).toBeInTheDocument();
    });
  });

  it('shows "Save Draft" button (sender-only feature)', () => {
    render(<SenderBook />);

    expect(screen.getByRole('button', { name: /Save Draft/i })).toBeInTheDocument();
  });

  it('allows selecting Door-to-Door Add-On and Empty Box Delivery on Step 2 and reflects in Step 3 Cost Summary', async () => {
    render(<SenderBook />);

    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole('button', { name: /^Continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Primary Recipient/i)).toBeInTheDocument();
    });

    // Verify Door-to-Door and Empty Box options exist on Step 2
    expect(screen.getByText(/Door-to-Door Delivery Add-On/i)).toBeInTheDocument();
    expect(screen.getByText(/Empty Box Delivery Service/i)).toBeInTheDocument();

    // Select Saved Recipient
    const savedRecSelect = screen.getByLabelText(/Select Saved Contact/i);
    fireEvent.change(savedRecSelect, { target: { value: '1' } });

    // Select Box Type
    const jumboBtn = screen.getByRole('button', { name: /JUMBO/i });
    fireEvent.click(jumboBtn);

    // Toggle Door-to-Door
    const doorToDoorCheckbox = screen.getByRole('checkbox', { name: /Door-to-Door Delivery Add-On/i });
    fireEvent.click(doorToDoorCheckbox);

    // Toggle Empty Box Delivery
    const emptyBoxCheckbox = screen.getByLabelText(/I need empty boxes delivered to my address before pickup/i);
    fireEvent.click(emptyBoxCheckbox);

    // Step 2 -> Step 3
    fireEvent.click(screen.getByRole('button', { name: /Review Details/i }));

    await waitFor(() => {
      expect(screen.getByText(/Step 3 of 4/i)).toBeInTheDocument();
    });

    // Step 3 Cost Summary displays Empty Box Delivery line item
    expect(screen.getByText(/Empty Box Delivery \(1 @ \$10\.00\)/i)).toBeInTheDocument();
    // Step 3 shows Door-to-Door badge on box card
    expect(screen.getByText(/Door-to-Door/i)).toBeInTheDocument();
  });
});



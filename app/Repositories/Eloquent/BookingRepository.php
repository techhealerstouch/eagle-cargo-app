<?php

namespace App\Repositories\Eloquent;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Jobs\NotifyAdminOfNewBooking;
use App\Jobs\SendBookingConfirmationMail;
use App\Models\Area;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Recipient;
use App\Models\Runsheet;
use App\Models\Sender;
use App\Models\User;
use App\Repositories\Contracts\BookingRepositoryInterface;
use App\Services\ReferenceDataService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class BookingRepository implements BookingRepositoryInterface
{
    public function __construct(
        private readonly ReferenceDataService $referenceData,
    ) {}

    public function createBooking(array $data, ?Sender $sender = null): Booking
    {
        return DB::transaction(function () use ($data, $sender) {
            if ($sender) {
                $sender->update([
                    'first_name' => $data['first_name'],
                    'last_name' => $data['last_name'],
                    'email' => $data['email'],
                    'mobile' => $data['mobile'],
                    'address' => $data['address'],
                    'suburb' => $data['suburb'] ?? null,
                    'state' => $data['state'] ?? null,
                    'postcode' => $data['postcode'] ?? null,
                ]);
            } else {
                $sender = Sender::updateOrCreate(
                    ['email' => $data['email']],
                    [
                        'user_id' => $data['user_id'] ?? Auth::id(),
                        'first_name' => $data['first_name'],
                        'last_name' => $data['last_name'],
                        'mobile' => $data['mobile'],
                        'address' => $data['address'],
                        'suburb' => $data['suburb'] ?? null,
                        'state' => $data['state'] ?? null,
                        'postcode' => $data['postcode'] ?? null,
                    ]
                );
            }

            // Generate Booking Shell
            $booking = $sender->bookings()->create([
                'reference_number' => null, // Handled by BookingObserver
                'initialization_key' => $data['initialization_key'] ?? null,
                'booking_type' => $data['booking_type'] ?? 'home_pickup',
                'preferred_date' => $data['preferred_date'] ?? null,
                'pickup_zone_id' => $data['pickup_zone_id'] ?? null,
                'payment_method' => $data['payment_method'] ?? 'stripe',
                'payment_status' => ($data['payment_method'] ?? null) === 'cash_on_pickup' ? PaymentStatus::CashOnPickup : PaymentStatus::Pending,
                'empty_box_count' => (int) ($data['empty_box_count'] ?? 0),
                'empty_box_fee' => (float) ($data['empty_box_fee'] ?? 10.00),
                'notes' => $data['notes'] ?? null,
            ]);

            // Resolve single recipient for the entire booking
            $recipient = $this->resolveSingleRecipient($sender, $data['boxes']);

            // Save boxes linked to single recipient
            foreach ($data['boxes'] as $index => $boxData) {
                $boxData['recipient_id'] = $recipient?->id;
                $boxData['area_id'] = $boxData['area_id'] ?? $recipient?->area_id;

                $boxData['pickup_zone_id'] = $data['pickup_zone_id'] ?? null;
                [$priceCharged, $priceIsEstimate] = $this->resolveBoxPrice($boxData, $index);

                $booking->boxes()->create([
                    'recipient_id' => $recipient?->id,
                    'box_type_id' => $boxData['is_custom_size'] ?? false ? null : ($boxData['box_type_id'] ?? null),
                    'is_custom_size' => $boxData['is_custom_size'] ?? false,
                    'is_door_to_door' => $boxData['is_door_to_door'] ?? false,
                    'custom_length' => $boxData['custom_length'] ?? null,
                    'custom_width' => $boxData['custom_width'] ?? null,
                    'custom_height' => $boxData['custom_height'] ?? null,
                    'price_charged' => $priceCharged,
                    'price_is_estimate' => $priceIsEstimate,
                ]);
            }

            // Ensure related models are available for notifications
            $booking->loadMissing(['sender', 'boxes.recipient']);

            // Dispatch notifications (async)
            SendBookingConfirmationMail::dispatch($booking)->afterCommit();
            NotifyAdminOfNewBooking::dispatch($booking)->afterCommit();

            return $booking;
        });
    }

    public function updateBooking(Booking $booking, array $data): Booking
    {
        return DB::transaction(function () use ($booking, $data) {
            // Check if updates are allowed â€” both Pending and Draft bookings can be edited
            if (! in_array($booking->status, [BookingStatus::Pending, BookingStatus::Draft])) {
                throw new \RuntimeException('Only pending or draft bookings can be updated.');
            }

            $invoice = $booking->invoice;
            if ($invoice) {
                if ($invoice->status !== \App\Enums\InvoiceStatus::Unpaid) {
                    throw new \RuntimeException('Cannot update a booking that has already been partially or fully paid.');
                }
                
                $pendingPayments = $invoice->payments()->whereNotNull('stripe_payment_intent_id')->get();
                foreach ($pendingPayments as $payment) {
                    try {
                        \Stripe\Stripe::setApiKey(config('services.stripe.secret'));
                        $intent = \Stripe\PaymentIntent::retrieve($payment->stripe_payment_intent_id);
                        if (!in_array($intent->status, ['canceled', 'succeeded'])) {
                            $intent->cancel();
                        }
                    } catch (\Exception $e) {
                        \Illuminate\Support\Facades\Log::warning('Failed to cancel intent during booking update: ' . $e->getMessage());
                    }
                }
                
                $invoice->payments()->delete();
                $invoice->delete();
            }

            // Update sender info if provided (Sender is associated via email)
            $sender = $booking->sender;
            $sender->update([
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'mobile' => $data['mobile'],
                'address' => $data['address'],
                'suburb' => $data['suburb'] ?? $sender->suburb,
                'state' => $data['state'] ?? $sender->state,
                'postcode' => $data['postcode'] ?? $sender->postcode,
            ]);

            // Update Booking Root
            $booking->update([
                'initialization_key' => $data['initialization_key'] ?? $booking->initialization_key,
                'booking_type' => $data['booking_type'] ?? $booking->booking_type,
                'preferred_date' => $data['preferred_date'] ?? $booking->preferred_date,
                'pickup_zone_id' => array_key_exists('pickup_zone_id', $data) ? $data['pickup_zone_id'] : $booking->pickup_zone_id,
                'payment_method' => $data['payment_method'] ?? $booking->payment_method,
                'empty_box_count' => isset($data['empty_box_count']) ? (int) $data['empty_box_count'] : $booking->empty_box_count,
                'empty_box_fee' => isset($data['empty_box_fee']) ? (float) $data['empty_box_fee'] : $booking->empty_box_fee,
                'notes' => $data['notes'] ?? $booking->notes,
            ]);

            // Remove existing boxes (and orphaning recipients if not reused, or just replace all)
            // For simplicity and to match frontend single-form logic, we replace the box set
            // Remove existing boxes
            $booking->boxes()->delete();

            // Resolve single recipient for the entire booking
            $recipient = $this->resolveSingleRecipient($sender, $data['boxes']);

            // Re-create boxes linked to single recipient
            foreach ($data['boxes'] as $index => $boxData) {
                $boxData['recipient_id'] = $recipient?->id;
                $boxData['area_id'] = $boxData['area_id'] ?? $recipient?->area_id;

                $boxData['pickup_zone_id'] = $data['pickup_zone_id'] ?? $booking->pickup_zone_id;
                [$priceCharged, $priceIsEstimate] = $this->resolveBoxPrice($boxData, $index);

                $booking->boxes()->create([
                    'recipient_id' => $recipient?->id,
                    'box_type_id' => $boxData['is_custom_size'] ?? false ? null : ($boxData['box_type_id'] ?? null),
                    'is_custom_size' => $boxData['is_custom_size'] ?? false,
                    'is_door_to_door' => $boxData['is_door_to_door'] ?? false,
                    'custom_length' => $boxData['custom_length'] ?? null,
                    'custom_width' => $boxData['custom_width'] ?? null,
                    'custom_height' => $boxData['custom_height'] ?? null,
                    'price_charged' => $priceCharged,
                    'price_is_estimate' => $priceIsEstimate,
                ]);
            }

            return $booking->refresh()->loadMissing(['sender', 'boxes.recipient']);
        });
    }

    public function cancelBooking(Booking $booking): bool
    {
        if (! in_array($booking->status, [BookingStatus::Pending, BookingStatus::Draft])) {
            throw new \RuntimeException('Only pending or draft bookings can be cancelled.');
        }

        $booking->bypassStatusValidation = true;
        return $booking->update(['status' => BookingStatus::Cancelled]);
    }

    /**
     * Save or update a draft booking with partial form data.
     * Draft data (boxes, payment_method) is stored as JSON in the notes field
     * prefixed with a marker so it can be distinguished from user notes.
     */
    public function saveDraft(array $data, Sender $sender, ?Booking $existingDraft = null): Booking
    {
        return DB::transaction(function () use ($data, $sender, $existingDraft) {
            // Update sender profile if data provided
            $senderFields = array_filter([
                'first_name' => $data['first_name'] ?? null,
                'last_name' => $data['last_name'] ?? null,
                'mobile' => $data['mobile'] ?? null,
                'address' => $data['address'] ?? null,
                'suburb' => $data['suburb'] ?? null,
                'state' => $data['state'] ?? null,
                'postcode' => $data['postcode'] ?? null,
            ], fn ($v) => $v !== null && $v !== '');

            if (! empty($senderFields)) {
                $sender->update($senderFields);
            }

            // Encode the full form snapshot as JSON for draft restoration
            $draftPayload = json_encode([
                'booking_type' => $data['booking_type'] ?? null,
                'preferred_date' => $data['preferred_date'] ?? null,
                'payment_method' => $data['payment_method'] ?? null,
                'notes' => $data['notes'] ?? null,
                'boxes' => $data['boxes'] ?? [],
            ]);

            $bookingData = [
                'booking_type' => $data['booking_type'] ?? ($existingDraft?->booking_type ?? 'home_pickup'),
                'preferred_date' => $data['preferred_date'] ?? null,
                'notes' => '<!--DRAFT_DATA-->'.$draftPayload,
            ];

            if ($existingDraft) {
                $existingDraft->update($bookingData);
                $draft = $existingDraft->refresh();
            } else {
                $draft = $sender->bookings()->create(array_merge($bookingData, [
                    'reference_number' => null, // Handled by BookingObserver
                    'status' => BookingStatus::Draft,
                ]));
            }

            $sender->bookings()
                ->where('status', BookingStatus::Draft)
                ->where('id', '!=', $draft->id)
                ->delete();

            return $draft;
        });
    }

    /**
     * Promote a draft booking to pending status with full data.
     * This replaces the draft payload with real boxes and recipients.
     */
    public function submitDraft(Booking $draft, array $data): Booking
    {
        if ($draft->status !== BookingStatus::Draft) {
            throw new \RuntimeException('Only draft bookings can be submitted.');
        }

        return DB::transaction(function () use ($draft, $data) {
            $sender = $draft->sender;

            // Update sender profile
            $sender->update([
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'email' => $data['email'],
                'mobile' => $data['mobile'],
                'address' => $data['address'],
                'suburb' => $data['suburb'] ?? null,
                'state' => $data['state'] ?? null,
                'postcode' => $data['postcode'] ?? null,
            ]);

            // Remove any existing draft boxes
            $draft->boxes()->delete();

            // Update booking to pending
            $draft->update([
                'status' => BookingStatus::Pending,
                'booking_type' => $data['booking_type'] ?? ($draft->booking_type ?? 'home_pickup'),
                'initialization_key' => $data['initialization_key'] ?? $draft->initialization_key,
                'preferred_date' => $data['preferred_date'] ?? null,
                'pickup_zone_id' => $data['pickup_zone_id'] ?? null,
                'payment_method' => $data['payment_method'] ?? 'stripe',
                'payment_status' => ($data['payment_method'] ?? null) === 'cash_on_pickup'
                    ? PaymentStatus::CashOnPickup
                    : PaymentStatus::Pending,
                'notes' => $data['notes'] ?? null,
            ]);

            // Resolve single recipient for the entire booking
            $recipient = $this->resolveSingleRecipient($sender, $data['boxes']);

            // Create boxes linked to single recipient
            foreach ($data['boxes'] as $index => $boxData) {
                $boxData['recipient_id'] = $recipient?->id;
                $boxData['area_id'] = $boxData['area_id'] ?? $recipient?->area_id;

                $boxData['pickup_zone_id'] = $data['pickup_zone_id'] ?? null;
                [$priceCharged, $priceIsEstimate] = $this->resolveBoxPrice($boxData, $index);

                $draft->boxes()->create([
                    'recipient_id' => $recipient?->id,
                    'box_type_id' => $boxData['is_custom_size'] ?? false ? null : ($boxData['box_type_id'] ?? null),
                    'is_custom_size' => $boxData['is_custom_size'] ?? false,
                    'is_door_to_door' => $boxData['is_door_to_door'] ?? false,
                    'custom_length' => $boxData['custom_length'] ?? null,
                    'custom_width' => $boxData['custom_width'] ?? null,
                    'custom_height' => $boxData['custom_height'] ?? null,
                    'price_charged' => $priceCharged,
                    'price_is_estimate' => $priceIsEstimate,
                ]);
            }

            $draft->loadMissing(['sender', 'boxes.recipient']);

            // Dispatch notifications
            SendBookingConfirmationMail::dispatch($draft)->afterCommit();
            NotifyAdminOfNewBooking::dispatch($draft)->afterCommit();

            return $draft;
        });
    }

    private function withResolvedDestinationArea(array $boxData, ?Recipient $recipient): array
    {
        if ($recipient) {
            $boxData['area_id'] = $recipient->area_id;

            return $boxData;
        }

        $areaId = $this->referenceData->resolveDestinationAreaId(
            $boxData['recipient_province'] ?? null,
            $boxData['recipient_city'] ?? null,
            $boxData['area_id'] ?? null,
        );

        if ($areaId === null) {
            throw new \InvalidArgumentException('Unable to resolve destination pricing area from recipient province and city.');
        }

        $boxData['area_id'] = $areaId;

        return $boxData;
    }

    /**
     * Resolve the price_charged and price_is_estimate values for a single box.
     *
     * - Preset box  -> price from the area x box_type matrix.
     * - Custom size -> CBM x area.cbm_rate (returns estimate flag = true).
     * - Door-to-door -> appends area.door_to_door_fee if enabled.
     *
     * @return array{float, bool} [price_charged, price_is_estimate]
     */
    private function resolveBoxPrice(array $boxData, int $index): array
    {
        $isCustom = filter_var($boxData['is_custom_size'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $isDoorToDoor = filter_var($boxData['is_door_to_door'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $doorToDoorFee = $isDoorToDoor ? $this->referenceData->doorToDoorFeeFor($boxData['area_id']) : 0.0;

        if ($isCustom) {
            $length = (float) ($boxData['custom_length'] ?? 0);
            $width = (float) ($boxData['custom_width'] ?? 0);
            $height = (float) ($boxData['custom_height'] ?? 0);

            if ($length <= 0 || $width <= 0 || $height <= 0) {
                throw new \InvalidArgumentException(
                    'Box '.($index + 1).' has custom size enabled but missing valid dimensions.'
                );
            }

            $cbm = ($length * $width * $height) / 1_000_000;
            $cbmRate = $this->referenceData->cbmRateFor($boxData['area_id'], $boxData['pickup_zone_id'] ?? null);

            if ($cbmRate === null || $cbmRate <= 0) {
                // No CBM rate configured — store 0 + door-to-door fee
                return [$doorToDoorFee, true];
            }

            $price = round($cbm * $cbmRate, 2) + $doorToDoorFee;

            return [$price, true]; // always flagged as an estimate
        }

        // Standard preset box — price from the area x box_type matrix
        $priceConfig = $this->referenceData->priceFor($boxData['area_id'], $boxData['box_type_id'], $boxData['pickup_zone_id'] ?? null);

        if (! $priceConfig || (float) $priceConfig->price <= 0.0) {
            throw new \InvalidArgumentException(
                'No price configured for box '.($index + 1).'. '
                .'Please ensure a price is set for area ID '.$boxData['area_id'].' and box type ID '.$boxData['box_type_id'].'. '
                .'Contact support to configure pricing.'
            );
        }

        $totalPrice = (float) $priceConfig->price + $doorToDoorFee;

        return [$totalPrice, false];
    }

    public function assignPickerToRunsheet(Booking $booking, int $pickerId, ?int $runsheetId = null): Booking
    {
        return DB::transaction(function () use ($booking, $pickerId, $runsheetId) {
            $lockedBooking = Booking::query()
                ->whereKey($booking->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! in_array($lockedBooking->payment_status, [PaymentStatus::Paid, PaymentStatus::Pending, PaymentStatus::CashOnPickup], true)) {
                throw new \InvalidArgumentException('Booking must be paid, pending, or payment on pickup before picker assignment.');
            }
            $this->assertEligibleForPickupAssignment($lockedBooking);

            $picker = User::findOrFail($pickerId);
            if ($picker->role !== Role::Picker) {
                throw new \InvalidArgumentException('Selected user is not a picker.');
            }

            $this->assertNoActiveAssignment($lockedBooking, RunsheetType::Pickup, $runsheetId);

            if (empty($runsheetId)) {
                $runsheet = Runsheet::create([
                    'picker_id' => $picker->id,
                    'scheduled_date' => now()->addDays(1),
                    'area_description' => $this->deriveAreaDescription($lockedBooking),
                    'status' => RunsheetStatus::Assigned,
                    'type' => RunsheetType::Pickup,
                ]);
            } else {
                $runsheet = Runsheet::query()
                    ->whereKey($runsheetId)
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($runsheet->status === RunsheetStatus::Completed) {
                    throw new \InvalidArgumentException('Cannot assign bookings to a completed runsheet.');
                }

                if ($runsheet->type !== RunsheetType::Pickup) {
                    throw new \InvalidArgumentException('Selected runsheet is not a pickup runsheet.');
                }

                $assignedPickerId = $runsheet->picker_id ?? $runsheet->courier_id;
                if ($assignedPickerId !== null && (int) $assignedPickerId !== $picker->id) {
                    throw new \InvalidArgumentException('Runsheet picker does not match selected picker.');
                }

                if ((int) ($runsheet->picker_id ?? 0) !== $picker->id) {
                    $runsheet->update(['picker_id' => $picker->id]);
                }

                $this->assertBookingMatchesRunsheetArea($lockedBooking, $runsheet);
            }

            $lockedBooking->runsheets()->syncWithoutDetaching([$runsheet->id]);

            return $lockedBooking->load('runsheets');
        });
    }

    public function assignToRunsheet(Booking $booking, int $courierId, ?int $runsheetId = null): Booking
    {
        return DB::transaction(function () use ($booking, $courierId, $runsheetId) {
            $lockedBooking = Booking::query()
                ->whereKey($booking->id)
                ->lockForUpdate()
                ->firstOrFail();

            $this->assertPaidBooking($lockedBooking, 'Booking must be paid before courier assignment.');
            $this->assertEligibleForDeliveryAssignment($lockedBooking);

            $courier = User::findOrFail($courierId);
            if ($courier->role !== Role::Courier) {
                throw new \InvalidArgumentException('Selected user is not a courier.');
            }

            $this->assertNoActiveAssignment($lockedBooking, RunsheetType::Delivery, $runsheetId);

            if (empty($runsheetId)) {
                // Create new runsheet for this courier
                $runsheet = Runsheet::create([
                    'courier_id' => $courier->id,
                    'scheduled_date' => now()->addDays(3),
                    'area_description' => $this->deriveAreaDescription($lockedBooking),
                    'status' => RunsheetStatus::Assigned,
                    'type' => RunsheetType::Delivery,
                ]);
            } else {
                $runsheet = Runsheet::query()
                    ->whereKey($runsheetId)
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($runsheet->courier_id !== $courier->id) {
                    throw new \InvalidArgumentException('Runsheet courier does not match selected courier.');
                }

                if ($runsheet->status === RunsheetStatus::Completed) {
                    throw new \InvalidArgumentException('Cannot assign bookings to a completed runsheet.');
                }

                if ($runsheet->type !== RunsheetType::Delivery) {
                    throw new \InvalidArgumentException('Selected runsheet is not a delivery runsheet.');
                }

                $this->assertBookingMatchesRunsheetArea($lockedBooking, $runsheet);
            }

            $boxIds = $lockedBooking->boxes()->pluck('boxes.id')->all();
            if (empty($boxIds)) {
                throw new \InvalidArgumentException('Booking must have at least one box before courier assignment.');
            }

            app(\App\Services\RunsheetService::class)->attachBoxes($runsheet, $boxIds);

            return $lockedBooking->load('boxes.runsheets');
        });
    }

    private function assertPaidBooking(Booking $booking, string $message): void
    {
        if ($booking->payment_status !== PaymentStatus::Paid) {
            throw new \InvalidArgumentException($message);
        }
    }

    private function assertEligibleForPickupAssignment(Booking $booking): void
    {
        $status = $booking->status instanceof BookingStatus
            ? $booking->status
            : BookingStatus::from((string) $booking->status);

        if ($status !== BookingStatus::Confirmed) {
            throw new \InvalidArgumentException('Booking must be confirmed before picker assignment.');
        }
    }

    private function assertEligibleForDeliveryAssignment(Booking $booking): void
    {
        if (! $booking->hasCompletedPickupRunsheet()) {
            throw new \InvalidArgumentException('Assign a picker and complete pickup before assigning a courier.');
        }

        if (! $booking->hasWarehouseHandoffCompleted()) {
            throw new \InvalidArgumentException('Courier can only be assigned after warehouse handoff is complete.');
        }
    }

    private function assertNoActiveAssignment(Booking $booking, RunsheetType $type, ?int $excludeRunsheetId = null): void
    {
        if ($type === RunsheetType::Delivery) {
            $activeAssignment = $booking->boxes()
                ->whereHas('runsheets', function ($query) use ($type, $excludeRunsheetId) {
                    $query->where('type', $type->value)
                        ->whereIn('status', RunsheetStatus::activeValues())
                        ->when(! empty($excludeRunsheetId), fn ($query) => $query->where('runsheets.id', '!=', $excludeRunsheetId));
                });
        } else {
            $activeAssignment = $booking->runsheets()
                ->where('type', $type->value)
                ->whereIn('status', RunsheetStatus::activeValues())
                ->when(! empty($excludeRunsheetId), fn ($query) => $query->where('runsheets.id', '!=', $excludeRunsheetId));
        }

        if ($activeAssignment->exists()) {
            throw new \InvalidArgumentException(sprintf(
                'This booking is already assigned to another active %s runsheet.',
                $type->value
            ));
        }
    }

    private function deriveAreaDescription(Booking $booking): string
    {
        $areaDescription = $booking->boxes()
            ->with('recipient')
            ->get()
            ->pluck('recipient.province')
            ->filter()
            ->unique()
            ->implode(', ');

        return $areaDescription ?: 'General Area';
    }

    private function assertBookingMatchesRunsheetArea(Booking $booking, Runsheet $runsheet): void
    {
        $bookingAreaIds = $this->resolveBookingAreaIds($booking);
        if ($bookingAreaIds->isEmpty()) {
            return;
        }

        $runsheetType = $runsheet->type instanceof RunsheetType
            ? $runsheet->type
            : RunsheetType::from((string) $runsheet->type);

        if ($runsheetType === RunsheetType::Delivery) {
            $runsheetAreaIds = $runsheet->boxes()
                ->with('recipient:id,area_id')
                ->get()
                ->map(fn (Box $box) => $box->recipient?->area_id)
                ->filter()
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->sort()
                ->values();
        } else {
            $runsheetAreaIds = $runsheet->bookings()
                ->where('bookings.id', '!=', $booking->id)
                ->with('boxes.recipient:id,area_id')
                ->get()
                ->flatMap(fn (Booking $runsheetBooking) => $this->resolveBookingAreaIds($runsheetBooking)->all())
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->sort()
                ->values();
        }

        if ($runsheetAreaIds->isEmpty()) {
            return;
        }

        $mismatchedAreas = $runsheetAreaIds->diff($bookingAreaIds)->isNotEmpty()
            || $bookingAreaIds->diff($runsheetAreaIds)->isNotEmpty();

        if (! $mismatchedAreas) {
            return;
        }

        throw new \InvalidArgumentException(sprintf(
            'Cannot mix bookings from different areas in the same runsheet. Runsheet areas: %s. Booking areas: %s.',
            $this->formatAreaNames($runsheetAreaIds),
            $this->formatAreaNames($bookingAreaIds)
        ));
    }

    private function resolveBookingAreaIds(Booking $booking): Collection
    {
        $booking->loadMissing('boxes.recipient:id,area_id');

        return $booking->boxes
            ->map(fn ($box) => $box->recipient?->area_id)
            ->filter(fn ($areaId) => $areaId !== null)
            ->map(fn ($areaId) => (int) $areaId)
            ->unique()
            ->sort()
            ->values();
    }

    private function formatAreaNames(Collection $areaIds): string
    {
        $namesById = Area::query()
            ->whereIn('id', $areaIds->all())
            ->pluck('name', 'id');

        $names = $areaIds
            ->map(fn (int $areaId) => $namesById->get($areaId, 'Area #'.$areaId))
            ->values();

        return $names->implode(', ');
    }

    private function resolveSingleRecipient(Sender $sender, array $boxesData): ?Recipient
    {
        $firstBox = $boxesData[0] ?? [];
        $recipient = null;

        if (! empty($firstBox['recipient_id'])) {
            $recipient = $sender->recipients()->find($firstBox['recipient_id']);
        }

        $firstBox = $this->withResolvedDestinationArea($firstBox, $recipient);

        if (! $recipient) {
            $firstName = $firstBox['recipient_first_name'] ?? null;
            $lastName = $firstBox['recipient_last_name'] ?? null;
            $email = $firstBox['recipient_email'] ?? null;
            $address = $firstBox['recipient_address'] ?? null;

            if ($firstName && $lastName && $address) {
                /** @var Recipient|null $candidate */
                $candidate = $sender->recipients()
                    ->where('first_name', $firstName)
                    ->where('last_name', $lastName)
                    ->where('address', $address)
                    ->when($email, fn ($q) => $q->where('email', $email))
                    ->first();

                if ($candidate) {
                    $candidate->update([
                        'area_id' => $firstBox['area_id'] ?? $candidate->area_id,
                        'name' => trim($firstName.' '.$lastName),
                        'email' => $email,
                        'phone_number' => $firstBox['recipient_phone'] ?? $candidate->phone_number,
                        'address' => $address,
                        'city' => $firstBox['recipient_city'] ?? $candidate->city,
                        'province' => $firstBox['recipient_province'] ?? $candidate->province,
                        'zip_code' => $firstBox['recipient_zip_code'] ?? $candidate->zip_code,
                        'landmarks' => $firstBox['recipient_landmarks'] ?? $candidate->landmarks,
                    ]);
                    $recipient = $candidate;
                }
            }

            if (! $recipient && $address) {
                $recipient = $sender->recipients()->create([
                    'area_id' => $firstBox['area_id'],
                    'name' => trim(($firstBox['recipient_first_name'] ?? '').' '.($firstBox['recipient_last_name'] ?? '')),
                    'first_name' => $firstBox['recipient_first_name'] ?? null,
                    'last_name' => $firstBox['recipient_last_name'] ?? null,
                    'email' => $firstBox['recipient_email'] ?? null,
                    'phone_number' => $firstBox['recipient_phone'] ?? null,
                    'address' => $firstBox['recipient_address'],
                    'city' => $firstBox['recipient_city'],
                    'province' => $firstBox['recipient_province'],
                    'zip_code' => $firstBox['recipient_zip_code'],
                    'landmarks' => $firstBox['recipient_landmarks'] ?? null,
                ]);
            }
        }

        return $recipient;
    }
}

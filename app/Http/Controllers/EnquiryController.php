<?php

namespace App\Http\Controllers;

use App\Events\EnquiryMessageUpdated;
use App\Http\Requests\StoreEnquiryRequest;
use App\Models\Enquiry;

class EnquiryController extends Controller
{
    public function store(StoreEnquiryRequest $request)
    {
        $enquiry = Enquiry::create($request->validated());
        EnquiryMessageUpdated::dispatch($enquiry);

        return redirect()->back()->with('success', 'Your message has been sent successfully. We will be in touch soon!');
    }
}

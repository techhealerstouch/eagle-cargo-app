<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreEnquiryRequest;
use App\Models\Enquiry;

class EnquiryController extends Controller
{
    public function store(StoreEnquiryRequest $request)
    {
        Enquiry::create($request->validated());

        return redirect()->back()->with('success', 'Your message has been sent successfully. We will be in touch soon!');
    }
}

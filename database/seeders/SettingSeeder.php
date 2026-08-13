<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $settings = [
            [
                'key' => 'invoice_company_name',
                'value' => 'BOX TRACKER',
                'type' => 'string',
                'group' => 'invoice',
                'display_name' => 'Company Name',
            ],
            [
                'key' => 'invoice_address',
                'value' => '123 Logistics Way, Sydney NSW 2000',
                'type' => 'string',
                'group' => 'invoice',
                'display_name' => 'Company Address',
            ],
            [
                'key' => 'invoice_phone',
                'value' => '+61 2 9876 5432',
                'type' => 'string',
                'group' => 'invoice',
                'display_name' => 'Contact Number',
            ],
            [
                'key' => 'invoice_abn',
                'value' => '12 345 678 901',
                'type' => 'string',
                'group' => 'invoice',
                'display_name' => 'ABN/Registration Number',
            ],
            [
                'key' => 'invoice_bank_name',
                'value' => 'Comm Bank',
                'type' => 'string',
                'group' => 'invoice',
                'display_name' => 'Bank Name',
            ],
            [
                'key' => 'invoice_bank_bsb',
                'value' => '062-000',
                'type' => 'string',
                'group' => 'invoice',
                'display_name' => 'Bank BSB',
            ],
            [
                'key' => 'invoice_bank_account',
                'value' => '1234 5678',
                'type' => 'string',
                'group' => 'invoice',
                'display_name' => 'Bank Account Number',
            ],
            [
                'key' => 'invoice_terms',
                'value' => 'TERMS: PAYMENT REQUIRED WITHIN 14 DAYS. GOODS DISPATCHED UPON CLEARANCE.',
                'type' => 'string',
                'group' => 'invoice',
                'display_name' => 'Payment Terms',
            ],
            [
                'key' => 'invoice_tax_rate',
                'value' => '0.10',
                'type' => 'string',
                'group' => 'invoice',
                'display_name' => 'Tax Rate (Decimal i.e. 0.10 for 10%)',
            ],
            [
                'key' => 'invoice_tax_label',
                'value' => 'GST',
                'type' => 'string',
                'group' => 'invoice',
                'display_name' => 'Tax Label (e.g. GST, VAT, Tax)',
            ],
            [
                'key' => 'invoice_footer',
                'value' => 'Box Tracker International Logistics',
                'type' => 'string',
                'group' => 'invoice',
                'display_name' => 'Invoice Footer Label',
            ],
            [
                'key' => 'invoice_logo',
                'value' => null,
                'type' => 'string',
                'group' => 'invoice',
                'display_name' => 'Invoice Logo',
            ],
            [
                'key' => 'declaration_header_text',
                'value' => "Shipper's Export Declaration",
                'type' => 'string',
                'group' => 'declaration',
                'display_name' => 'Header Text',
            ],
            [
                'key' => 'declaration_instructions',
                'value' => 'Please declare all items in your Balikbayan box. Prohibited items include firearms, explosives, illegal drugs, and perishable goods. Providing false information may result in delays or confiscation.',
                'type' => 'string',
                'group' => 'declaration',
                'display_name' => 'Instructions',
            ],
            [
                'key' => 'declaration_footer_text',
                'value' => 'I declare that the information provided is true and accurate.',
                'type' => 'string',
                'group' => 'declaration',
                'display_name' => 'Footer Text',
            ],
            [
                'key' => 'declaration_terms',
                'value' => "TERMS AND CONDITIONS:\n1. Shipment means all documents and parcels under one receipt which will be carried through sea carrier LOVE BALIKBAYAN BOX CARGO chooses. Every shipment is transported on a limited liability basis unless Shipper requires greater protection at a higher freight cost.\n2. Shipper is obligated to declare all items included in the shipment, OTHERWISE, LOVE BALIKBAYAN BOX CARGO’s liability for loss, damage, or delay shall be as follows:\nA. For lost or damaged shipments with NO DECLARED VALUE, liability shall only be limited to refund of freight fee, regardless of the actual content of the parcel.\nB. For lost or damaged shipments with DECLARED VALUE, liability shall only be limited up to A\$300.00 regardless of the actual/declared content of the package.\nC. The Shipper can avail of additional insurance based on the actual DECLARED VALUE. Additional insurance cost will be calculated upon purchase [please update the value per box/per receipt].\n3. LOVE BALIKBAYAN BOX CARGO shall not be liable for loss, damage, or delay arising from act of God, force majeure, acts of government authority, or shipper’s breach of this contract.\n4. LOVE BALIKBAYAN BOX CARGO will not be liable at ANY COST for any damages caused by leakage, improper packaging, or any internal faulty packaging (i.e. leak from liquid items, opened food items, breakage of fragile items)\n5. LOVE BALIKBAYAN BOX CARGO shall not be liable for other damages, such as moral and exemplary damages, and consequential damages, unless, the amount of foreseen consequential damage is declared during the acceptance and a higher freight fee is paid.\n6. Shipper warrants the following:\nA. All information is true and correct, particularly, names and addresses of the Shipper and Consignee, as well as, the declared contents and value of the shipment.\nB. The shipment contains no hazardous or prohibited items, e.g. explosives, flammable, firearms and parts, ammunition, illegal drugs, live animals, and all other items prohibited by law or common carriers, or requires a government permit for its transport.\n7. Shipper warrants and agrees that the Consignee or any person of sufficient age and discretion will be at the given address to receive the shipment on the agreed day of delivery and shipment may be released to the latter in the absence of the Consignee.\n8. Shipper agrees to check and verify the status of his shipment at LOVE BALIKBAYAN BOX CARGO social media pages within five (5) days from first attempt of delivery. Failure of acceptance on first attempt delivery, the delivery status mentioned in LOVE BALIKBAYAN BOX webpage or private notice is deemed sufficient notice to the shipper and is obligated to claim his shipment within thirty (30) days from first attempt of delivery, otherwise, LOVE BALIKBAYAN BOX CARGO shall dispose the same in a manner it sees fit and apply the proceeds, if any, for storage fee from the date of posting of non-delivery until claimed or disposed of.\n9. Consignee or any person of sufficient age and discretion shall check the shipment upon receipt and the shipment is deemed delivered and received in good order and condition in the absence of a complaint or noted damage immediately communicated to LOVE BALIKBAYAN BOX CARGO.\n10. LOVE BALIKBAYAN BOX CARGO may open and check the shipment prior to acceptance in the presence of the Shipper or authorized representative to ensure that the shipment contains no hazardous or prohibited content. LOVE BALIKBAYAN BOX CARGO reserves its right to refuse acceptance which, in its discretion, would be violative of its policies and pertinent laws.\n11. All claims must be filed in writing within thirty (30) days from the date of transaction, otherwise, the same shall be denied.\n12. Any court action arising from this contract shall be brought to the proper court of State of Victoria, Australia to the exclusion of all other courts.\n13. Parties herein warrant that they are of legal age and have the full legal capacity to enter into this contract at the time of the transaction.\n14. By transacting with LOVE BALIKBAYAN BOX CARGO, Shipper warrants that he/she has read, understood and agreed to the full terms and conditions of LOVE Balikbayan Boxes Cargo found in its website and displayed in the declaration form.\nDisclaimer of Warranties\n1. The services, the content and the information on this form are provided on an \"as is\" basis. Love Balikbayan Boxes Cargo, to the fullest extent permitted by law, disclaims all warranties, whether express, implied, statutory or otherwise, including but not limited to the implied warranties of merchantability, non-infringement of third party rights and fitness for a particular purpose. LOVE Balikbayan Boxes Cargo, its affiliates and licensors make no representations or warranties about the accuracy, completeness, security or timeliness of the services, content or information provided on or through the LOVE Balikbayan Boxes Cargo website or systems. No information obtained via the LOVE BALIKBAYAN BOXES CARGO systems or website shall create any warranty not expressly stated by Love Balikbayan Boxes Cargo in these terms and conditions.\n2. Some jurisdictions do not allow limitations of implied warranties, so the limitations and exclusions in this section may not apply to you. If you are dealing as a consumer, these provisions do not affect your statutory rights that cannot be waived, if any. You agree and acknowledge that the limitations and exclusions of liability and warranty provided in these terms and conditions are fair and reasonable.\nLimitation of Liability\nTo the extent permitted by law, in no event shall LOVE BALIKBAYAN BOXES CARGO, its affiliates or licensors or any third parties mentioned at the LOVE BALIKBAYAN BOX CARGO website be liable for any incidental, indirect, exemplary, punitive and consequential damages, lost profits, or damages resulting from lost data or business interruption resulting from the use of or inability to use the LOVE BALIKBAYAN BOX CARGO website and LOVE BALIKBAYAN BOX CARGO systems, services, content or information whether based on warranty, contract, tort, delict, or any other legal theory, and whether or not LOVE BALIKBAYAN BOX CARGO is advised of the possibility of such damages.\nProducts and Services\nUnless otherwise agreed in writing, the transportation products and services mentioned in these web pages are subject to ORIENT FREIGHT Terms and Conditions of carriage. Since these may vary depending on the location of the country of origin of the shipment, please contact the ORIENT FREIGHT social media pages to obtain a copy of the local terms and conditions. Not all LOVE BALIKBAYAN BOX CARGO products and services may be available in every country",
                'type' => 'string',
                'group' => 'declaration',
                'display_name' => 'Terms & Conditions',
            ],
            [
                'key' => 'declaration_require_signature',
                'value' => '1',
                'type' => 'bool',
                'group' => 'declaration',
                'display_name' => 'Require Signature',
            ],
            [
                'key' => 'declaration_subtitle',
                'value' => "Shipper's Packing List - Balikbayan Box",
                'type' => 'string',
                'group' => 'declaration',
                'display_name' => 'Subtitle',
            ],
            [
                'key' => 'declaration_badge_1',
                'value' => 'Official Document',
                'type' => 'string',
                'group' => 'declaration',
                'display_name' => 'Badge 1',
            ],
            [
                'key' => 'declaration_badge_2',
                'value' => 'LVB-LOG-VERIFIED',
                'type' => 'string',
                'group' => 'declaration',
                'display_name' => 'Badge 2 (Tracking ID)',
            ],
            [
                'key' => 'declaration_form_info',
                'value' => 'Form 291-B Revised 2026',
                'type' => 'string',
                'group' => 'declaration',
                'display_name' => 'Form Info',
            ],
            [
                'key' => 'declaration_prohibited_title',
                'value' => 'Prohibited Items Notice:',
                'type' => 'string',
                'group' => 'declaration',
                'display_name' => 'Prohibited Notice Title',
            ],
            [
                'key' => 'declaration_prohibited_notice',
                'value' => 'Firearms, ammunition, illegal drugs, explosives, flammable materials, live animals, counterfeit goods, and other hazardous materials are strictly prohibited. This document is a legally binding declaration under the Customs Modernization and Tariff Act (CMTA) of the Philippines.',
                'type' => 'string',
                'group' => 'declaration',
                'display_name' => 'Prohibited Notice',
            ],
            [
                'key' => 'declaration_brand_name',
                'value' => 'Love Balikbayan Logistics System',
                'type' => 'string',
                'group' => 'declaration',
                'display_name' => 'Brand Name',
            ],
            [
                'key' => 'declaration_origin_location',
                'value' => 'Victoria, Australia',
                'type' => 'string',
                'group' => 'declaration',
                'display_name' => 'Origin Location',
            ],
        ];

        foreach ($settings as $setting) {
            Setting::updateOrCreate(['key' => $setting['key']], $setting);
        }
    }
}

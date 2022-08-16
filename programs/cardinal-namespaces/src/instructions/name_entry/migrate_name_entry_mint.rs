use anchor_lang::solana_program::program::invoke;
use mpl_token_metadata::instruction::{create_master_edition_v3, create_metadata_accounts_v2};

use {
    crate::{errors::ErrorCode, state::*},
    anchor_lang::{prelude::*, solana_program::program::invoke_signed, solana_program::program_pack::Pack},
    anchor_spl::{
        associated_token::{self, AssociatedToken},
        token::{self, Mint, Token, TokenAccount},
    },
    cardinal_token_manager::{
        self,
        program::CardinalTokenManager,
        state::{InvalidationType, TokenManagerKind},
    },
    mpl_token_metadata::state::Creator as MCreator,
    spl_token::solana_program::system_instruction,
    urlencoding::encode,
};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MigrateNameEntryMintIx {
    pub duration: Option<i64>,
}

#[derive(Accounts)]
#[instruction(ix: MigrateNameEntryMintIx)]
pub struct MigrateNameEntryMintCtx<'info> {
    #[account(mut)]
    namespace: Box<Account<'info, Namespace>>,
    #[account(mut)]
    name_entry: Account<'info, Entry>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    namespace_token_account: AccountInfo<'info>,

    #[account(mut)]
    payer: Signer<'info>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut, constraint = namespace_certificate_token_account.mint == name_entry.mint
        && namespace_certificate_token_account.owner == namespace.key()
        && namespace_certificate_token_account.amount == 1 @ ErrorCode::NamespaceRequiresToken )]
    namespace_certificate_token_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    mint: Signer<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    mint_metadata: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    master_edition: AccountInfo<'info>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    mint_counter: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    token_manager: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    token_manager_token_account: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    recipient_token_account: AccountInfo<'info>,

    #[account(mut,
        close = namespace,
        constraint = claim_request.is_approved
        && claim_request.namespace == namespace.key()
        && claim_request.entry_name == name_entry.name
        && claim_request.requestor == payer.key()
        && claim_request.counter == name_entry.claim_request_counter
        @ ErrorCode::ClaimNotAllowed
    )]
    claim_request: Box<Account<'info, ClaimRequest>>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(address = mpl_token_metadata::id())]
    token_metadata_program: AccountInfo<'info>,
    token_program: Program<'info, Token>,
    associated_token: Program<'info, AssociatedToken>,
    token_manager_program: Program<'info, CardinalTokenManager>,

    rent: Sysvar<'info, Rent>,
    system_program: Program<'info, System>,
}

pub fn handler<'key, 'accounts, 'remaining, 'info>(ctx: Context<'key, 'accounts, 'remaining, 'info, MigrateNameEntryMintCtx<'info>>, ix: MigrateNameEntryMintIx) -> Result<()> {
    handle_init_name_entry_mint_and_claim(ctx, ix.duration)?;
    Ok(())
}

// #[inline(never)]
// fn handle_invalidate_init_name_entry_mint_and_claim<'info>(ctx: Context<'_, '_, '_, 'info, MigrateNameEntryMintCtx<'info>>, duration: Option<i64>) -> Result<()> {
//     // Start Invalidate Expired Name Entry

//     if ctx.accounts.name_entry.reverse_entry.is_some() {
//         if !ctx.accounts.reverse_name_entry.data_is_empty() {
//             let reverse_entry = Account::<ReverseEntry>::try_from(&ctx.accounts.reverse_name_entry)?;
//             if reverse_entry.entry_name == ctx.accounts.name_entry.name {
//                 reverse_entry.close(ctx.accounts.requestor.to_account_info())?;
//             }
//         }
//     }

//     // End Invalidate Expired Name Entry

//     handle_init_name_entry_mint_and_claim(ctx, duration)?;

//     Ok(())
// }

#[inline(never)]
fn handle_init_name_entry_mint_and_claim<'info>(ctx: Context<'_, '_, '_, 'info, MigrateNameEntryMintCtx<'info>>, duration: Option<i64>) -> Result<()> {
    // Start Init Name Entry Mint

    let name_entry = &mut ctx.accounts.name_entry;
    name_entry.namespace = ctx.accounts.namespace.key();
    name_entry.mint = ctx.accounts.mint.key();

    let namespace_seeds = &[NAMESPACE_PREFIX.as_bytes(), ctx.accounts.namespace.name.as_bytes(), &[ctx.accounts.namespace.bump]];
    let namespace_signer = &[&namespace_seeds[..]];

    // create account for mint
    invoke(
        &system_instruction::create_account(
            ctx.accounts.payer.key,
            ctx.accounts.mint.key,
            ctx.accounts.rent.minimum_balance(spl_token::state::Mint::LEN),
            spl_token::state::Mint::LEN as u64,
            &spl_token::id(),
        ),
        &[ctx.accounts.payer.to_account_info(), ctx.accounts.mint.to_account_info()],
    )?;

    // initialize mint
    let cpi_accounts = token::InitializeMint {
        mint: ctx.accounts.mint.to_account_info(),
        rent: ctx.accounts.rent.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
    token::initialize_mint(cpi_context, 0, &ctx.accounts.namespace.key(), Some(&ctx.accounts.namespace.key()))?;

    // do you have plans for tomorrow
    // you tryna go out in the city

    // create metadata
    invoke_signed(
        &create_metadata_accounts_v2(
            *ctx.accounts.token_metadata_program.key,
            *ctx.accounts.mint_metadata.key,
            *ctx.accounts.mint.key,
            ctx.accounts.namespace.key(),
            *ctx.accounts.payer.key,
            ctx.accounts.namespace.key(),
            ctx.accounts.namespace.name.clone(),
            "NAME".to_string(),
            // generative URL which will inclde image of the name with expiration data
            "https://nft.cardinal.so/metadata/".to_string() + &ctx.accounts.mint.key().to_string() + &"?name=".to_string() + &encode(ctx.accounts.name_entry.name.as_str()).into_owned(),
            Some(vec![MCreator {
                address: ctx.accounts.namespace.key(),
                verified: true,
                share: 100,
            }]),
            0,
            true,
            true,
            None,
            None,
        ),
        &[
            ctx.accounts.mint_metadata.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.namespace.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.namespace.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ],
        namespace_signer,
    )?;

    // create associated token account for namespace
    let cpi_accounts = associated_token::Create {
        payer: ctx.accounts.payer.to_account_info(),
        associated_token: ctx.accounts.namespace_token_account.to_account_info(),
        authority: ctx.accounts.namespace.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        rent: ctx.accounts.rent.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
    associated_token::create(cpi_context)?;

    // mint single token to namespace token account
    let cpi_accounts = token::MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.namespace_token_account.to_account_info(),
        authority: ctx.accounts.namespace.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts).with_signer(namespace_signer);
    token::mint_to(cpi_context, 1)?;

    // create master edition
    invoke_signed(
        &create_master_edition_v3(
            *ctx.accounts.token_metadata_program.key,
            *ctx.accounts.master_edition.key,
            *ctx.accounts.mint.key,
            ctx.accounts.namespace.key(),
            ctx.accounts.namespace.key(),
            ctx.accounts.mint_metadata.key(),
            ctx.accounts.payer.key(),
            Some(0),
        ),
        &[
            ctx.accounts.master_edition.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.namespace.to_account_info(),
            ctx.accounts.namespace.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.mint_metadata.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ],
        namespace_signer,
    )?;

    // End Init Name Entry Mint

    claim(ctx, duration)?;

    Ok(())
}

#[inline(never)]
fn claim<'info>(ctx: Context<'_, '_, '_, 'info, MigrateNameEntryMintCtx<'info>>, duration: Option<i64>) -> Result<()> {
    // Start Claim

    let remaining_accs = &mut ctx.remaining_accounts.iter();
    let name_entry = &mut ctx.accounts.name_entry;
    let namespace = &mut ctx.accounts.namespace;
    name_entry.data = Some(ctx.accounts.payer.key());
    name_entry.claim_request_counter = name_entry.claim_request_counter.checked_add(1).expect("Add error");
    namespace.count = namespace.count.checked_add(1).expect("Add error");

    if ctx.accounts.namespace.limit.is_some() && ctx.accounts.namespace.count > ctx.accounts.namespace.limit.unwrap() {
        return Err(error!(ErrorCode::NamespaceReachedLimit));
    }

    // if name_entry.is_claimed {
    //     return Err(error!(ErrorCode::NameEntryAlreadyClaimed));
    // }
    // name_entry.is_claimed = true;

    // duration checks
    if duration.is_some() {
        if duration.unwrap() <= ctx.accounts.namespace.min_rental_seconds {
            return Err(error!(ErrorCode::RentalDurationTooSmall));
        }
        if ctx.accounts.namespace.max_rental_seconds.is_some() && duration.unwrap() >= ctx.accounts.namespace.max_rental_seconds.unwrap() {
            return Err(error!(ErrorCode::RentalDurationTooLarge));
        }
    } else if ctx.accounts.namespace.max_rental_seconds.is_some() {
        return Err(error!(ErrorCode::NamespaceRequiresDuration));
    }

    let namespace_seeds = &[NAMESPACE_PREFIX.as_bytes(), ctx.accounts.namespace.name.as_bytes(), &[ctx.accounts.namespace.bump]];
    let namespace_signer = &[&namespace_seeds[..]];

    if ctx.accounts.token_manager_token_account.data_is_empty() {
        // create associated token account for certificate mint
        let cpi_accounts = associated_token::Create {
            payer: ctx.accounts.payer.to_account_info(),
            associated_token: ctx.accounts.token_manager_token_account.to_account_info(),
            authority: ctx.accounts.token_manager.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
        associated_token::create(cpi_context)?;
    }

    // token manager init
    let init_ix = cardinal_token_manager::instructions::InitIx {
        amount: 1,
        kind: if ctx.accounts.namespace.transferable_entries {
            TokenManagerKind::Unmanaged as u8
        } else {
            TokenManagerKind::Edition as u8
        },
        invalidation_type: if ctx.accounts.namespace.invalidation_type == 0 {
            if ctx.accounts.namespace.transferable_entries {
                InvalidationType::Invalidate as u8
            } else {
                InvalidationType::Return as u8
            }
        } else {
            ctx.accounts.namespace.invalidation_type
        },
        num_invalidators: if ctx.accounts.namespace.payment_amount_daily > 0 || ctx.accounts.namespace.max_expiration.is_some() {
            2
        } else {
            1
        },
    };
    let cpi_accounts = cardinal_token_manager::cpi::accounts::InitCtx {
        token_manager: ctx.accounts.token_manager.to_account_info(),
        mint_counter: ctx.accounts.mint_counter.to_account_info(),
        issuer: ctx.accounts.namespace.to_account_info(),
        payer: ctx.accounts.payer.to_account_info(),
        issuer_token_account: ctx.accounts.namespace_token_account.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_manager_program.to_account_info(), cpi_accounts).with_signer(namespace_signer);
    cardinal_token_manager::cpi::init(cpi_ctx, init_ix)?;

    // add invalidator
    let cpi_accounts = cardinal_token_manager::cpi::accounts::AddInvalidatorCtx {
        token_manager: ctx.accounts.token_manager.to_account_info(),
        issuer: ctx.accounts.namespace.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_manager_program.to_account_info(), cpi_accounts).with_signer(namespace_signer);
    cardinal_token_manager::cpi::add_invalidator(cpi_ctx, ctx.accounts.namespace.key())?;

    let mut payment_manager_account_info: Option<&AccountInfo> = None;
    let mut time_invalidator_account_info: Option<&AccountInfo> = None;
    let mut time_invalidator_program: Option<&AccountInfo> = None;
    if ctx.accounts.namespace.payment_amount_daily > 0 || ctx.accounts.namespace.max_expiration.is_some() {
        // payment_mint
        let payment_mint_account_info = next_account_info(remaining_accs)?;
        let payment_mint = Account::<Mint>::try_from(payment_mint_account_info)?;
        if payment_mint.key() != ctx.accounts.namespace.payment_mint {
            return Err(error!(ErrorCode::InvalidPaymentMint));
        }
        payment_manager_account_info = Some(next_account_info(remaining_accs)?);
        time_invalidator_account_info = Some(next_account_info(remaining_accs)?);
        time_invalidator_program = Some(next_account_info(remaining_accs)?);
        if time_invalidator_program.expect("Expected time_invalidator_program").key() != cardinal_time_invalidator::id() {
            return Err(error!(ErrorCode::InvalidTimeInvalidatorProgramId));
        }

        // init time invalidator
        let init_ix = cardinal_time_invalidator::instructions::InitIx {
            collector: ctx.accounts.namespace.key(),
            payment_manager: payment_manager_account_info.expect("Expected payment_manager").key(),
            duration_seconds: if ctx.accounts.namespace.payment_amount_daily > 0 { Some(0) } else { None },
            extension_payment_amount: if ctx.accounts.namespace.payment_amount_daily > 0 {
                Some(ctx.accounts.namespace.payment_amount_daily)
            } else {
                None
            },
            extension_duration_seconds: if ctx.accounts.namespace.payment_amount_daily > 0 { Some(86400) } else { None },
            extension_payment_mint: if ctx.accounts.namespace.payment_amount_daily > 0 { Some(payment_mint.key()) } else { None },
            max_expiration: ctx.accounts.namespace.max_expiration,
            disable_partial_extension: None,
        };
        let cpi_accounts = cardinal_time_invalidator::cpi::accounts::InitCtx {
            token_manager: ctx.accounts.token_manager.to_account_info(),
            issuer: ctx.accounts.namespace.to_account_info(),
            payer: ctx.accounts.payer.to_account_info(),
            time_invalidator: time_invalidator_account_info.expect("Expected time_invalidator_account_info").to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(time_invalidator_program.unwrap().to_account_info(), cpi_accounts).with_signer(namespace_signer);
        cardinal_time_invalidator::cpi::init(cpi_ctx, init_ix)?;

        //add time invalidator
        let cpi_accounts = cardinal_token_manager::cpi::accounts::AddInvalidatorCtx {
            token_manager: ctx.accounts.token_manager.to_account_info(),
            issuer: ctx.accounts.namespace.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_manager_program.to_account_info(), cpi_accounts).with_signer(namespace_signer);
        cardinal_token_manager::cpi::add_invalidator(cpi_ctx, time_invalidator_account_info.expect("Expected time_invalidator_account_info").to_account_info().key())?;
    }

    // token manager issue
    let cpi_accounts = cardinal_token_manager::cpi::accounts::IssueCtx {
        token_manager: ctx.accounts.token_manager.to_account_info(),
        token_manager_token_account: ctx.accounts.token_manager_token_account.to_account_info(),
        issuer: ctx.accounts.namespace.to_account_info(),
        issuer_token_account: ctx.accounts.namespace_token_account.to_account_info(),
        payer: ctx.accounts.payer.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_manager_program.to_account_info(), cpi_accounts).with_signer(namespace_signer);
    cardinal_token_manager::cpi::issue(cpi_ctx)?;

    // create associated token account for recipient
    let cpi_accounts = associated_token::Create {
        payer: ctx.accounts.payer.to_account_info(),
        associated_token: ctx.accounts.recipient_token_account.to_account_info(),
        authority: ctx.accounts.payer.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        rent: ctx.accounts.rent.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
    associated_token::create(cpi_context)?;

    // token manager claim
    let cpi_accounts = cardinal_token_manager::cpi::accounts::ClaimCtx {
        token_manager: ctx.accounts.token_manager.to_account_info(),
        token_manager_token_account: ctx.accounts.token_manager_token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        recipient: ctx.accounts.payer.to_account_info(),
        recipient_token_account: ctx.accounts.recipient_token_account.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_manager_program.to_account_info(), cpi_accounts).with_remaining_accounts(remaining_accs.cloned().collect::<Vec<AccountInfo<'info>>>());
    cardinal_token_manager::cpi::claim(cpi_ctx)?;

    if ctx.accounts.namespace.payment_amount_daily > 0 && duration.expect("Duration required") > 0 {
        let payer_token_account_info = next_account_info(remaining_accs)?;
        let payment_token_account = next_account_info(remaining_accs)?;
        let fee_collector_token_account = next_account_info(remaining_accs)?;
        let payment_manager_program = next_account_info(remaining_accs)?;

        let cpi_accounts = cardinal_time_invalidator::cpi::accounts::ExtendExpirationCtx {
            token_manager: ctx.accounts.token_manager.to_account_info(),
            time_invalidator: time_invalidator_account_info.expect("Expected time_invalidator").to_account_info(),
            payer: ctx.accounts.payer.to_account_info(),
            payment_manager: payment_manager_account_info.expect("Expected payment_manager").to_account_info(),
            payment_token_account: payment_token_account.to_account_info(),
            fee_collector_token_account: fee_collector_token_account.to_account_info(),
            payer_token_account: payer_token_account_info.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            cardinal_payment_manager: payment_manager_program.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(time_invalidator_program.expect("Expected time_invalidator_program").to_account_info(), cpi_accounts).with_signer(namespace_signer);
        cardinal_time_invalidator::cpi::extend_expiration(cpi_ctx, duration.expect("Duration required").try_into().expect("Duration invalid"))?;
    }

    // End Claim

    Ok(())
}

use anchor_spl::token::TokenAccount;

use {
    crate::{errors::ErrorCode, state::*},
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
#[instruction(entry_name: String, user: Pubkey)]
pub struct ApproveClaimRequestCtx<'info> {
    namespace: Account<'info, Namespace>,
    #[account(mut)]
    payer: Signer<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        space = CLAIM_REQUEST_SIZE,
        seeds = [CLAIM_REQUEST_SEED.as_bytes(), namespace.key().as_ref(), entry_name.as_bytes(), user.as_ref()],
        bump,
    )]
    claim_request: Account<'info, ClaimRequest>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    name_entry: UncheckedAccount<'info>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    approve_authority: UncheckedAccount<'info>,

    system_program: Program<'info, System>,
}

pub fn handler<'key, 'accounts, 'remaining, 'info>(ctx: Context<'key, 'accounts, 'remaining, 'info, ApproveClaimRequestCtx<'info>>, entry_name: String, user: Pubkey) -> Result<()> {
    let claim_request = &mut ctx.accounts.claim_request;
    claim_request.bump = *ctx.bumps.get("claim_request").unwrap();
    claim_request.namespace = ctx.accounts.namespace.key();
    claim_request.entry_name = entry_name;
    claim_request.is_approved = true;
    claim_request.requestor = user;
    claim_request.counter = 0;

    let remaining_accs = &mut ctx.remaining_accounts.iter();
    let user_name_entry_mint_token_account_info = next_account_info(remaining_accs);
    if user_name_entry_mint_token_account_info.is_err() {
        if !ctx.accounts.approve_authority.is_signer || ctx.accounts.approve_authority.key() != ctx.accounts.namespace.approve_authority.unwrap() {
            return Err(error!(ErrorCode::InvalidApproveAuthority));
        }
    } else {
        let user_name_entry_mint_token_account = Account::<TokenAccount>::try_from(user_name_entry_mint_token_account_info?)?;
        let name_entry = Account::<Entry>::try_from(&ctx.accounts.name_entry.to_account_info())?;
        if user_name_entry_mint_token_account.mint != name_entry.mint || user_name_entry_mint_token_account.amount == 0 || user_name_entry_mint_token_account.owner != user {
            return Err(error!(ErrorCode::InvalidUserTokenAccount));
        }
    }

    if !ctx.accounts.name_entry.data_is_empty() {
        let name_entry = Account::<Entry>::try_from(&ctx.accounts.name_entry)?;
        claim_request.counter = name_entry.claim_request_counter;
    }

    Ok(())
}

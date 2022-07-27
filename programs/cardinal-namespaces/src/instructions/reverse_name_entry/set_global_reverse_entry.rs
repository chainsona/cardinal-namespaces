use anchor_spl::token::TokenAccount;
use cardinal_token_manager::state::{TokenManager, TokenManagerState};
use {
    crate::{errors::ErrorCode, state::*},
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct SetGlobalReverseEntryCtx<'info> {
    namespace: Box<Account<'info, Namespace>>,
    #[account(
        mut,
        seeds = [ENTRY_SEED.as_bytes(), namespace.key().as_ref(), entry.name.as_bytes()],
        bump = entry.bump,
    )]
    entry: Box<Account<'info, Entry>>,
    #[account(
        init_if_needed,
        payer = payer,
        space = REVERSE_ENTRY_SIZE,
        seeds = [REVERSE_ENTRY_SEED.as_bytes(), user.key().as_ref()],
        bump,
    )]
    reverse_entry: Box<Account<'info, ReverseEntry>>,

    #[account(constraint =
        user_token_manager_token_account.mint == entry.mint
        && user_token_manager_token_account.owner == user.key()
        && user_token_manager_token_account.amount > 0
        @ ErrorCode::InvalidOwnerMint
    )]
    user_token_manager_token_account: Box<Account<'info, TokenAccount>>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    token_manager: UncheckedAccount<'info>,

    #[account(mut)]
    user: Signer<'info>,
    #[account(mut)]
    payer: Signer<'info>,
    system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SetGlobalReverseEntryCtx>) -> Result<()> {
    let namespace = &mut ctx.accounts.namespace;
    let entry = &mut ctx.accounts.entry;
    entry.reverse_entry = Some(ctx.accounts.reverse_entry.key());

    let token_manager = Account::<TokenManager>::try_from(&&ctx.accounts.token_manager)?;
    if token_manager.mint != entry.mint || token_manager.issuer != namespace.key() || token_manager.state == TokenManagerState::Invalidated as u8 {
        return Err(error!(ErrorCode::InvalidTokenManager));
    }

    let reverse_entry = &mut ctx.accounts.reverse_entry;
    reverse_entry.bump = *ctx.bumps.get("reverse_entry").unwrap();
    reverse_entry.namespace_name = ctx.accounts.namespace.name.clone();
    reverse_entry.entry_name = entry.name.clone();
    Ok(())
}

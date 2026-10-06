import { Request, Response } from 'express';

export class AuthController {
  private getExpectedCredentials() {
    return {
      username: process.env.ADMIN_USERNAME || 'hichamadmin267',
      password: process.env.ADMIN_PASSWORD || 'admin2671',
    };
  }

  async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;
      const creds = this.getExpectedCredentials();

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Veuillez saisir votre nom d\'utilisateur et mot de passe',
        });
      }

      if (username === creds.username && password === creds.password) {
        const token = Buffer.from(`${username}:${Date.now()}:${process.env.JWT_SECRET || 'secret'}`).toString('base64');
        return res.json({
          success: true,
          token,
          user: {
            username: creds.username,
            name: 'Hicham',
            role: 'Super Administrateur',
            platform: 'Easy Linge Kech — May Business SARL',
          },
        });
      }

      return res.status(401).json({
        success: false,
        error: 'Identifiant ou mot de passe incorrect',
      });
    } catch (err: any) {
      console.error('[AUTH] Erreur login:', err);
      return res.status(500).json({ success: false, error: 'Erreur interne du serveur d\'authentification' });
    }
  }

  async verify(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Session non autorisée' });
      }

      const token = authHeader.replace('Bearer ', '');
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const creds = this.getExpectedCredentials();

      if (decoded.startsWith(creds.username)) {
        return res.json({
          success: true,
          valid: true,
          user: {
            username: creds.username,
            name: 'Hicham',
            role: 'Super Administrateur',
          },
        });
      }

      return res.status(401).json({ success: false, error: 'Jeton de session expiré ou invalide' });
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Session invalide' });
    }
  }
}

export const authController = new AuthController();
